export type Stage = "junior" | "senior";

export interface Klass {
  id: string;
  name: string;
  stage: Stage;
  grade: string;
  createdAt: number;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  createdAt: number;
}

export interface Assessment {
  id: string;
  classId: string;
  name: string;
  date: string;
  fullScore: number;
  createdAt: number;
}

export interface Score {
  assessmentId: string;
  studentId: string;
  value: number;
}

export interface GeneratedProfile {
  profile: string;
  message: string;
  updatedAt: number;
}

/** 教学节奏建议：加快 / 维持 / 减缓 */
export type ClassPace = "加快" | "维持" | "减缓";

export interface ClassReport {
  headline: string;
  pace: ClassPace;
  diagnosis: string;
  actions: string[];
  updatedAt: number;
}

/** 点名状态：到 / 迟到 / 请假 / 缺勤 */
export type AttendanceStatus = "present" | "late" | "leave" | "absent";

export interface Lesson {
  id: string;
  classId: string;
  date: string;
  period: string;
  subject?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Attendance {
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  updatedAt: number;
}

export interface AppData {
  version: 1;
  classes: Klass[];
  students: Student[];
  assessments: Assessment[];
  scores: Score[];
  profiles: Record<string, GeneratedProfile>;
  reports: Record<string, ClassReport>;
  lessons: Lesson[];
  attendance: Attendance[];
}
