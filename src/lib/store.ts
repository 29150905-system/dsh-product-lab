import type {
  AppData,
  Assessment,
  GeneratedProfile,
  Klass,
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
    classes: [],
    students: [],
    assessments: [],
    scores: [],
    profiles: {},
    reports: {},
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

  return {
    version: 1,
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
      profiles: parsed.profiles ?? {},
      reports: parsed.reports ?? {},
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
