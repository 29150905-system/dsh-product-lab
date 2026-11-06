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

export interface AppData {
  version: 1;
  classes: Klass[];
  students: Student[];
  assessments: Assessment[];
  scores: Score[];
  profiles: Record<string, GeneratedProfile>;
  reports: Record<string, ClassReport>;
}
