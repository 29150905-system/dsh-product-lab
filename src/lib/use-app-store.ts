"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AppData,
  Assessment,
  AttendanceSheet,
  CallResult,
  ClassReport,
  GeneratedProfile,
  Lesson,
  Stage,
} from "./types";
import { createStudents, emptyData, loadData, profileKey, reportKey, saveData, uid } from "./store";
import {
  decryptData,
  encryptData,
  fetchRemote,
  getDeviceId,
  pushRemote,
  readSyncConfig,
  writeSyncConfig,
} from "./sync";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPush: AppData | null = null;

async function pushNow(data: AppData): Promise<boolean> {
  const config = readSyncConfig();
  if (!config?.enabled) return false;
  try {
    const { iv, ct } = await encryptData(data, config.code);
    const result = await pushRemote(config.code, {
      updatedAt: data.updatedAt ?? Date.now(),
      iv,
      ct,
      deviceId: getDeviceId(),
    });
    if (result.ok) {
      writeSyncConfig({ ...config, lastSyncAt: Date.now() });
      return true;
    }
  } catch {
    // 网络或加密失败：下次改动会再试
  }
  return false;
}

function schedulePush(data: AppData) {
  const config = readSyncConfig();
  if (!config?.enabled) return;
  pendingPush = data;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const latest = pendingPush;
    pendingPush = null;
    if (latest) void pushNow(latest);
  }, 1200);
}

export async function pushCurrent(data: AppData): Promise<boolean> {
  return pushNow(data);
}

export async function pullIfNewer(
  local: AppData,
  apply: (data: AppData) => void,
): Promise<"applied" | "pushed" | "none"> {
  const config = readSyncConfig();
  if (!config?.enabled) return "none";
  const remote = await fetchRemote(config.code);
  if (!remote.ok || !remote.doc) return "none";
  const remoteAt = remote.doc.updatedAt ?? 0;
  const localAt = local.updatedAt ?? 0;
  if (remoteAt > localAt) {
    try {
      const incoming = await decryptData(remote.doc.iv, remote.doc.ct, config.code);
      const next: AppData = { ...incoming, updatedAt: remoteAt };
      saveData(next);
      writeSyncConfig({ ...config, lastSyncAt: Date.now() });
      apply(next);
      return "applied";
    } catch {
      return "none";
    }
  }
  if (localAt > remoteAt) {
    const ok = await pushNow(local);
    return ok ? "pushed" : "none";
  }
  return "none";
}

export interface NewAssessmentInput {
  classId: string;
  name: string;
  date: string;
  fullScore: number;
  values: Record<string, number>;
}

export function useAppStore() {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    const local = loadData();
    setData(local);
    void pullIfNewer(local, (incoming) => setData(incoming));
  }, []);

  const mutate = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = { ...updater(current ?? emptyData()), updatedAt: Date.now() };
      saveData(next);
      schedulePush(next);
      return next;
    });
  }, []);

  const addClass = useCallback(
    (input: { name: string; stage: Stage; grade: string }): string => {
      const id = uid("cls");
      mutate((current) => ({
        ...current,
        classes: [
          ...current.classes,
          {
            id,
            name: input.name.trim(),
            stage: input.stage,
            grade: input.grade.trim(),
            createdAt: Date.now(),
          },
        ],
      }));
      return id;
    },
    [mutate],
  );

  const addStudents = useCallback(
    (classId: string, names: string[]) => {
      mutate((current) => createStudents(current, classId, names));
    },
    [mutate],
  );

  const addAssessment = useCallback(
    (input: NewAssessmentInput): string => {
      const id = uid("asm");
      const assessment: Assessment = {
        id,
        classId: input.classId,
        name: input.name.trim(),
        date: input.date,
        fullScore: input.fullScore,
        createdAt: Date.now(),
      };
      mutate((current) => ({
        ...current,
        assessments: [...current.assessments, assessment],
        scores: [
          ...current.scores,
          ...Object.entries(input.values)
            .filter(([, value]) => Number.isFinite(value))
            .map(([studentId, value]) => ({
              assessmentId: id,
              studentId,
              value,
            })),
        ],
      }));
      return id;
    },
    [mutate],
  );

  const saveProfile = useCallback(
    (
      assessmentId: string,
      studentId: string,
      input: Pick<GeneratedProfile, "profile" | "message">,
    ) => {
      const key = profileKey(assessmentId, studentId);
      mutate((current) => ({
        ...current,
        profiles: {
          ...current.profiles,
          [key]: { ...input, updatedAt: Date.now() },
        },
      }));
    },
    [mutate],
  );

  const saveReport = useCallback(
    (assessmentId: string, input: Omit<ClassReport, "updatedAt">) => {
      const key = reportKey(assessmentId);
      mutate((current) => ({
        ...current,
        reports: {
          ...current.reports,
          [key]: { ...input, updatedAt: Date.now() },
        },
      }));
    },
    [mutate],
  );

  const addLesson = useCallback(
    (input: {
      classId: string;
      date: string;
      period: string;
      subject?: string;
      note?: string;
    }): string => {
      const id = uid("lsn");
      const now = Date.now();
      const lesson: Lesson = {
        id,
        classId: input.classId,
        date: input.date,
        period: input.period,
        subject: input.subject?.trim() || undefined,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      mutate((current) => ({
        ...current,
        lessons: [...current.lessons, lesson],
      }));
      return id;
    },
    [mutate],
  );

  const updateLesson = useCallback(
    (
      lessonId: string,
      patch: Partial<Pick<Lesson, "date" | "period" | "subject" | "note">>,
    ) => {
      mutate((current) => ({
        ...current,
        lessons: current.lessons.map((lesson) =>
          lesson.id === lessonId
            ? {
                ...lesson,
                ...patch,
                subject: patch.subject === undefined ? lesson.subject : patch.subject.trim() || undefined,
                note: patch.note === undefined ? lesson.note : patch.note.trim() || undefined,
                updatedAt: Date.now(),
              }
            : lesson,
        ),
      }));
    },
    [mutate],
  );

  const addCall = useCallback(
    (lessonId: string, studentId: string, result: CallResult): string => {
      const id = uid("call");
      const now = Date.now();
      mutate((current) => ({
        ...current,
        calls: [...current.calls, { id, lessonId, studentId, result, createdAt: now }],
      }));
      return id;
    },
    [mutate],
  );

  const deleteCall = useCallback(
    (callId: string) => {
      mutate((current) => ({
        ...current,
        calls: current.calls.filter((call) => call.id !== callId),
      }));
    },
    [mutate],
  );

  const addSheet = useCallback(
    (input: { classId: string; date: string; period: string; note?: string }): string => {
      const id = uid("att");
      const now = Date.now();
      const sheet: AttendanceSheet = {
        id,
        classId: input.classId,
        date: input.date,
        period: input.period,
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      mutate((current) => ({
        ...current,
        attendanceSheets: [...current.attendanceSheets, sheet],
      }));
      return id;
    },
    [mutate],
  );

  const updateSheet = useCallback(
    (sheetId: string, patch: Partial<Pick<AttendanceSheet, "date" | "period" | "note">>) => {
      mutate((current) => ({
        ...current,
        attendanceSheets: current.attendanceSheets.map((sheet) =>
          sheet.id === sheetId
            ? {
                ...sheet,
                ...patch,
                note: patch.note === undefined ? sheet.note : patch.note.trim() || undefined,
                updatedAt: Date.now(),
              }
            : sheet,
        ),
      }));
    },
    [mutate],
  );

  const toggleAbsent = useCallback(
    (sheetId: string, studentId: string) => {
      const now = Date.now();
      mutate((current) => {
        const existing = current.attendanceMarks.find(
          (mark) => mark.sheetId === sheetId && mark.studentId === studentId,
        );
        if (existing) {
          return {
            ...current,
            attendanceMarks: current.attendanceMarks.filter(
              (mark) => !(mark.sheetId === sheetId && mark.studentId === studentId),
            ),
          };
        }
        return {
          ...current,
          attendanceMarks: [
            ...current.attendanceMarks,
            { sheetId, studentId, absent: true, updatedAt: now },
          ],
        };
      });
    },
    [mutate],
  );

  const setAllPresent = useCallback(
    (sheetId: string) => {
      mutate((current) => ({
        ...current,
        attendanceMarks: current.attendanceMarks.filter((mark) => mark.sheetId !== sheetId),
      }));
    },
    [mutate],
  );

  return {
    data,
    addClass,
    addStudents,
    addAssessment,
    saveProfile,
    saveReport,
    addLesson,
    updateLesson,
    addCall,
    deleteCall,
    addSheet,
    updateSheet,
    toggleAbsent,
    setAllPresent,
  };
}
