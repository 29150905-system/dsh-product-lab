import type {
  AppData,
  Assessment,
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
  return { version: 1, classes: [], students: [], assessments: [], scores: [] };
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
    return parsed;
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

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
