export enum UserRole {
  TEACHER = 'teacher',
  STUDENT = 'student'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  aboutMe?: string;
  createdAt: number;
}

export enum TaskType {
  MULTIPLE_CHOICE = 'multiple_choice', // a, b, c (single)
  MULTIPLE_SELECT = 'multiple_select', // Checkboxes (multiple)
  FILL_IN_BLANKS = 'fill_in_blanks', // -1- logic
  MATCHING = 'matching', // connect pairs
  CATEGORIZE = 'categorize', // Divide by categories
  TRUE_FALSE = 'true_false', // t:fact, f:fact
  ORDER = 'order', // Establish correct order
  TABLE = 'table', // Fill in table
  PUZZLE = 'puzzle', // Puzzle/Jigsaw
  FREE_TEXT = 'free_text', // teacher graded
  USE_FROM_LIST = 'use_from_list' // Word bank
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio';
  url: string; // URL or Base64
  sourceType: 'upload' | 'url'; // To distinguish for UI
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  content: any; // Flexible based on type
  correctAnswers: any; // Flexible based on type
  media?: MediaAttachment;
  createdAt: number;
  isArchived?: boolean;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  taskTitle: string;
  answers: any;
  score: number; // Percentage 0-100
  status: 'graded' | 'pending';
  teacherComment?: string;
  submittedAt: number;
}

// Specific content structures
export interface MultipleChoiceContent {
  question: string;
  options: string[]; // [a, b, c]
}

export interface FillBlanksContent {
  text: string; // "Hello -1-, how are -2-?"
}
// correctAnswers for FillBlanks is map { "1": "world :: earth", "2": "you" }

export interface MatchingContent {
  pairs: MatchingPair[];
}

export interface FreeTextContent {
  prompt: string;
}