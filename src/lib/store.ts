import type {
  AppData,
  Assessment,
  AttendanceMark,
  AttendanceSheet,
  CallRecord,
  CallResult,
  GeneratedProfile,
  Klass,
  Lesson,
  Score,
  Stage,
  Student,
} from "./types";

const STORAGE_KEY = "jingming:v1";

export function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyData(): AppData {
  return {
    version: 1,
    updatedAt: 0,
    classes: [],
    students: [],
    assessments: [],
    scores: [],
    profiles: {},
    reports: {},
    lessons: [],
    calls: [],
    attendanceSheets: [],
    attendanceMarks: [],
  };
}

export function seedData(): AppData {
  const now = Date.now();
  const classId = "cls_demo";
  const names = [
    "陈星",
    "林一诺",
    "王雨桐",
    "李泽宇",
    "赵思远",
    "周可欣",
    "吴梓涵",
    "郑皓",
    "孙悦",
    "钱嘉禾",
  ];
  const students: Student[] = names.map((name, index) => ({
    id: `stu_demo_${index + 1}`,
    classId,
    name,
    createdAt: now + index,
  }));
  const assessmentId = "asm_demo_1";
  const values = [82, 76, 91, 68, 74, 88, 79, 85, 63, 90];
  const scores: Score[] = students.map((student, index) => ({
    assessmentId,
    studentId: student.id,
    value: values[index] ?? 0,
  }));

  const lessonId = "lsn_demo_1";
  const demoResults: CallResult[] = ["good", "ok", "good", "poor", "ok"];
  const calls: CallRecord[] = demoResults.map((result, index) => ({
    id: `call_demo_${index + 1}`,
    lessonId,
    studentId: students[index].id,
    result,
    createdAt: now + index * 60_000,
  }));

  const sheetId = "att_demo_1";
  const attendanceMarks: AttendanceMark[] = [
    { sheetId, studentId: students[7].id, absent: true, updatedAt: now },
  ];

  return {
    version: 1,
    updatedAt: now,
    classes: [
      {
        id: classId,
        name: "高一(3)班",
        stage: "senior",
        grade: "高一",
        createdAt: now,
      },
    ],
    students,
    assessments: [
      {
        id: assessmentId,
        classId,
        name: "第一次月考",
        date: "2026-10-20",
        fullScore: 100,
        createdAt: now,
      },
    ],
    scores,
    profiles: {},
    reports: {},
    lessons: [
      {
        id: lessonId,
        classId,
        date: "2026-10-21",
        period: "第 3 节",
        subject: "数学",
        note: "函数单调性复习，小测 10 分钟",
        createdAt: now,
        updatedAt: now,
      },
    ],
    calls,
    attendanceSheets: [
      {
        id: sheetId,
        classId,
        date: "2026-10-21",
        period: "第 3 节",
        createdAt: now,
        updatedAt: now,
      },
    ],
    attendanceMarks,
  };
}

function isValid(data: unknown): data is AppData {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<AppData>;
  return (
    value.version === 1 &&
    Array.isArray(value.classes) &&
    Array.isArray(value.students) &&
    Array.isArray(value.assessments) &&
    Array.isArray(value.scores)
  );
}

export function loadData(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedData();
      saveData(seeded);
      return seeded;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      const seeded = seedData();
      saveData(seeded);
      return seeded;
    }
    return {
      ...parsed,
      updatedAt: parsed.updatedAt ?? 0,
      profiles: parsed.profiles ?? {},
      reports: parsed.reports ?? {},
      lessons: parsed.lessons ?? [],
      calls: parsed.calls ?? [],
      attendanceSheets: parsed.attendanceSheets ?? [],
      attendanceMarks: parsed.attendanceMarks ?? [],
    };
  } catch {
    const seeded = seedData();
    saveData(seeded);
    return seeded;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createClass(
  data: AppData,
  input: { name: string; stage: Stage; grade: string },
): { data: AppData; klass: Klass } {
  const klass: Klass = {
    id: uid("cls"),
    name: input.name.trim(),
    stage: input.stage,
    grade: input.grade.trim(),
    createdAt: Date.now(),
  };
  return { data: { ...data, classes: [...data.classes, klass] }, klass };
}

export function createStudents(
  data: AppData,
  classId: string,
  names: string[],
): AppData {
  const existing = new Set(
    data.students
      .filter((student) => student.classId === classId)
      .map((student) => student.name),
  );
  const now = Date.now();
  const students: Student[] = names
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !existing.has(name))
    .map((name, index) => ({
      id: uid("stu"),
      classId,
      name,
      createdAt: now + index,
    }));
  if (students.length === 0) return data;
  return { ...data, students: [...data.students, ...students] };
}

export function createAssessment(
  data: AppData,
  input: {
    classId: string;
    name: string;
    date: string;
    fullScore: number;
    values: Record<string, number>;
  },
): { data: AppData; assessment: Assessment } {
  const assessment: Assessment = {
    id: uid("asm"),
    classId: input.classId,
    name: input.name.trim(),
    date: input.date,
    fullScore: input.fullScore,
    createdAt: Date.now(),
  };
  const scores: Score[] = Object.entries(input.values)
    .filter(([, value]) => Number.isFinite(value))
    .map(([studentId, value]) => ({
      assessmentId: assessment.id,
      studentId,
      value,
    }));
  return {
    data: {
      ...data,
      assessments: [...data.assessments, assessment],
      scores: [...data.scores, ...scores],
    },
    assessment,
  };
}

export function classStudents(data: AppData, classId: string): Student[] {
  return data.students
    .filter((student) => student.classId === classId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function classAssessments(data: AppData, classId: string): Assessment[] {
  return data.assessments
    .filter((assessment) => assessment.classId === classId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function latestScores(
  data: AppData,
  assessmentId: string,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const score of data.scores) {
    if (score.assessmentId === assessmentId) map[score.studentId] = score.value;
  }
  return map;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function profileKey(assessmentId: string, studentId: string): string {
  return `${assessmentId}:${studentId}`;
}

export function reportKey(assessmentId: string): string {
  return assessmentId;
}

/** 回答结果顺序与文案 */
export const CALL_ORDER: CallResult[] = ["good", "ok", "poor"];

export const CALL_LABELS: Record<CallResult, string> = {
  good: "答得好",
  ok: "一般",
  poor: "没答上来",
};

export const CALL_TONES: Record<CallResult, string> = {
  good: "bg-emerald-50 text-emerald-700",
  ok: "bg-amber-50 text-amber-700",
  poor: "bg-red-50 text-red-700",
};

export function defaultPeriodLabel(now = new Date()): string {
  const hour = now.getHours();
  let index = 1;
  if (hour >= 8 && hour < 9) index = 1;
  else if (hour >= 9 && hour < 10) index = 2;
  else if (hour >= 10 && hour < 11) index = 3;
  else if (hour >= 11 && hour < 12) index = 4;
  else if (hour >= 13 && hour < 14) index = 5;
  else if (hour >= 14 && hour < 15) index = 6;
  else if (hour >= 15 && hour < 16) index = 7;
  else if (hour >= 16 && hour < 17) index = 8;
  else index = 1;
  return `第 ${index} 节`;
}

export function classLessons(data: AppData, classId: string): Lesson[] {
  return data.lessons
    .filter((lesson) => lesson.classId === classId)
    .sort((a, b) => {
      if (a.date === b.date) return b.createdAt - a.createdAt;
      return a.date < b.date ? 1 : -1;
    });
}

export function lessonCalls(data: AppData, lessonId: string): CallRecord[] {
  return data.calls
    .filter((call) => call.lessonId === lessonId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface LessonCallStats {
  calls: number;
  covered: number;
  students: number;
  good: number;
  ok: number;
  poor: number;
}

export function lessonCallStats(
  data: AppData,
  lessonId: string,
  studentIds: string[],
): LessonCallStats {
  const calls = data.calls.filter((call) => call.lessonId === lessonId);
  const covered = new Set(calls.map((call) => call.studentId)).size;
  return {
    calls: calls.length,
    covered,
    students: studentIds.length,
    good: calls.filter((call) => call.result === "good").length,
    ok: calls.filter((call) => call.result === "ok").length,
    poor: calls.filter((call) => call.result === "poor").length,
  };
}

export interface StudentCallStats {
  total: number;
  good: number;
  ok: number;
  poor: number;
  lastCalledAt: number | null;
}

export function studentCallStats(data: AppData, studentId: string): StudentCallStats {
  const calls = data.calls.filter((call) => call.studentId === studentId);
  return {
    total: calls.length,
    good: calls.filter((call) => call.result === "good").length,
    ok: calls.filter((call) => call.result === "ok").length,
    poor: calls.filter((call) => call.result === "poor").length,
    lastCalledAt: calls.length === 0 ? null : Math.max(...calls.map((call) => call.createdAt)),
  };
}

/**
 * 随机挑一个学生：
 * 1) 优先本节课还没被点到过的；
 * 2) 同等条件下，优先累计被点次数最少的；
 * 3) 再同等，优先最久没被点到的；
 * 4) 最后在这些候选里随机。
 */
export function pickStudent(
  data: AppData,
  lessonId: string,
  students: Student[],
  random: () => number = Math.random,
): Student | null {
  if (students.length === 0) return null;
  const calledThisLesson = new Set(
    data.calls.filter((call) => call.lessonId === lessonId).map((call) => call.studentId),
  );
  let pool = students.filter((student) => !calledThisLesson.has(student.id));
  if (pool.length === 0) pool = students;

  const stats = new Map<string, StudentCallStats>();
  for (const student of pool) stats.set(student.id, studentCallStats(data, student.id));

  const minTotal = Math.min(...pool.map((student) => stats.get(student.id)!.total));
  let candidates = pool.filter((student) => stats.get(student.id)!.total === minTotal);

  if (candidates.length > 1) {
    const oldest = Math.min(
      ...candidates.map((student) => stats.get(student.id)!.lastCalledAt ?? 0),
    );
    candidates = candidates.filter(
      (student) => (stats.get(student.id)!.lastCalledAt ?? 0) === oldest,
    );
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[Math.max(0, index)] ?? null;
}

export function classAttendanceSheets(data: AppData, classId: string): AttendanceSheet[] {
  return data.attendanceSheets
    .filter((sheet) => sheet.classId === classId)
    .sort((a, b) => {
      if (a.date === b.date) return b.createdAt - a.createdAt;
      return a.date < b.date ? 1 : -1;
    });
}

/** 返回缺勤学生 id 集合 */
export function sheetAbsentIds(data: AppData, sheetId: string): Set<string> {
  return new Set(
    data.attendanceMarks
      .filter((mark) => mark.sheetId === sheetId && mark.absent)
      .map((mark) => mark.studentId),
  );
}

export interface SheetCounts {
  total: number;
  absent: number;
  present: number;
}

export function sheetCounts(data: AppData, sheetId: string, studentIds: string[]): SheetCounts {
  const absentIds = sheetAbsentIds(data, sheetId);
  const total = studentIds.length;
  const absent = studentIds.filter((studentId) => absentIds.has(studentId)).length;
  return { total, absent, present: total - absent };
}

export interface OverviewStats {
  examName: string;
  fullScore: number;
  count: number;
  average: number;
  median: number;
  max: number;
  min: number;
  passRate: number;
  excellentRate: number;
  lowRate: number;
  distribution: { label: string; count: number; ratio: number }[];
  previousAverage: number | null;
  previousExamName: string | null;
  trend: number | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 班级整体学情用的统计（不含姓名，可安全发给模型） */
export function overviewStats(
  data: AppData,
  classId: string,
  assessmentId: string,
): OverviewStats | null {
  const exam = data.assessments.find((item) => item.id === assessmentId);
  if (!exam) return null;
  const full = exam.fullScore > 0 ? exam.fullScore : 100;
  const students = classStudents(data, classId);
  const scores = latestScores(data, assessmentId);
  const values = students
    .map((student) => scores[student.id])
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => a - b);

  const count = values.length;
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = count > 0 ? round1(sum / count) : 0;
  const median =
    count === 0
      ? 0
      : count % 2 === 1
        ? values[(count - 1) / 2]
        : round1((values[count / 2 - 1] + values[count / 2]) / 2);

  const buckets: { label: string; min: number; max: number }[] = [
    { label: "90% 及以上", min: 0.9, max: Infinity },
    { label: "80%–90%", min: 0.8, max: 0.9 },
    { label: "70%–80%", min: 0.7, max: 0.8 },
    { label: "60%–70%", min: 0.6, max: 0.7 },
    { label: "60% 以下", min: 0, max: 0.6 },
  ];
  const distribution = buckets.map((bucket) => {
    const bucketCount = values.filter((value) => {
      const ratio = value / full;
      return ratio >= bucket.min && ratio < bucket.max;
    }).length;
    return {
      label: bucket.label,
      count: bucketCount,
      ratio: count === 0 ? 0 : Math.round((bucketCount / count) * 100),
    };
  });

  const rate = (predicate: (value: number) => boolean): number =>
    count === 0 ? 0 : Math.round((values.filter(predicate).length / count) * 100);

  const ordered = classAssessments(data, classId).slice().sort((a, b) => a.createdAt - b.createdAt);
  const index = ordered.findIndex((item) => item.id === assessmentId);
  const previous = index > 0 ? ordered[index - 1] : null;
  let previousAverage: number | null = null;
  if (previous) {
    const prevScores = latestScores(data, previous.id);
    const prevValues = students
      .map((student) => prevScores[student.id])
      .filter((value): value is number => Number.isFinite(value));
    if (prevValues.length > 0) previousAverage = average(prevValues);
  }

  return {
    examName: exam.name,
    fullScore: full,
    count,
    average: avg,
    median,
    max: count > 0 ? values[count - 1] : 0,
    min: count > 0 ? values[0] : 0,
    passRate: rate((value) => value >= full * 0.6),
    excellentRate: rate((value) => value >= full * 0.85),
    lowRate: rate((value) => value < full * 0.4),
    distribution,
    previousAverage,
    previousExamName: previous?.name ?? null,
    trend:
      previousAverage === null ? null : round1(avg - previousAverage),
  };
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
