"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppData, Assessment, ClassReport, GeneratedProfile, Stage } from "./types";
import { createStudents, emptyData, loadData, profileKey, reportKey, saveData, uid } from "./store";

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
    setData(loadData());
  }, []);

  const mutate = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => {
      const next = updater(current ?? emptyData());
      saveData(next);
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

  return { data, addClass, addStudents, addAssessment, saveProfile, saveReport };
}
