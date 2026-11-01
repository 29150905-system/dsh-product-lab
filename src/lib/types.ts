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

export interface AppData {
  version: 1;
  classes: Klass[];
  students: Student[];
  assessments: Assessment[];
  scores: Score[];
}
