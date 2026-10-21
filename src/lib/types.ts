// Data types after cleaning. ID and phone numbers never leave the server.

export type FamilyRecord = {
  id: string;
  family: string | null;
  name: string;
  city: string;
  district: string;
  service: string;
  status: string;
  result: string;
  notes: string;
  requestNo: string;
  birthDate: string | null; // ISO yyyy-mm-dd
  labDate: string | null;
  resultDate: string | null;
};

export type ChildRecord = {
  id: string;
  name: string;
  gender: string;
  birthDate: string | null;
  hospital: string;
  city: string;
  service: string;
  status: string;
  result: string;
  notes: string;
  guardian: string;
  // Optional columns: if the client adds them to the sheet, the "receipt to result" duration KPI works automatically
  receivedDate: string | null;
  resultDate: string | null;
};

export type PsychRecord = {
  id: string;
  guardian: string;
  caseType: string;
  age: number | null;
  city: string;
  specialist: string;
  service: string;
  status: string;
  reports: string;
};

export type IssueLevel = "error" | "warning";

export type DataIssue = {
  sheet: string;
  row: number;
  field: string;
  message: string;
  level: IssueLevel;
};

export type DashboardData = {
  source: "google" | "demo";
  fetchedAt: string;
  family: FamilyRecord[];
  children: ChildRecord[];
  psych: PsychRecord[];
  issues: DataIssue[];
  // Dropdown options from the sheet (data validation), so filters show every value, even unused ones
  lists?: { family: FieldLists; children: FieldLists };
  error?: string;
};

export type FieldLists = { services: string[]; statuses: string[]; results: string[]; cities: string[] };
