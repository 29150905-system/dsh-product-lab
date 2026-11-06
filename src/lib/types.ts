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

/** 一次提问点名的回答结果：答得好 / 一般 / 没答上来 */
export type CallResult = "good" | "ok" | "poor";

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

/** 一次课堂提问点名记录（谁、被点后答得怎么样、什么时候） */
export interface CallRecord {
  id: string;
  lessonId: string;
  studentId: string;
  result: CallResult;
  createdAt: number;
}

/** 出勤表：班级 + 日期 + 节次 的一张点名表 */
export interface AttendanceSheet {
  id: string;
  classId: string;
  date: string;
  period: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** 出勤表的缺勤标记（只存缺勤，默认全部出勤） */
export interface AttendanceMark {
  sheetId: string;
  studentId: string;
  absent: boolean;
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
  calls: CallRecord[];
  attendanceSheets: AttendanceSheet[];
  attendanceMarks: AttendanceMark[];
}
