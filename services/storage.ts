import { Task, TaskSubmission, User, UserRole, TaskType } from '../types';

const KEYS = {
  USERS: 'linguaflow_users',
  TASKS: 'linguaflow_tasks',
  SUBMISSIONS: 'linguaflow_submissions',
  CURRENT_USER: 'linguaflow_current_user'
};

// --- Helpers ---
const get = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultVal;
};

const set = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Auth ---
export const login = (username: string, password: string): User | null => {
  // Hardcoded teacher credentials
  if (username === 'teacher' && password === 'akula2026') {
    const teacher: User = {
      id: 'teacher-main',
      username: 'Teacher',
      role: UserRole.TEACHER,
      createdAt: Date.now()
    };
    set(KEYS.CURRENT_USER, teacher);
    return teacher;
  }

  const users = get<User[]>(KEYS.USERS, []);
  // In a real app, we'd check hashed passwords. Here we just check username for students
  // since registration stores "password" but we don't really validate it strictly for this mock
  // apart from finding the user.
  const user = users.find(u => u.username === username);
  
  // For demo purposes, we accept any password for students if user exists
  if (user) {
    set(KEYS.CURRENT_USER, user);
    return user;
  }
  return null;
};

export const register = (username: string, password: string): User | null => {
  const users = get<User[]>(KEYS.USERS, []);
  if (users.find(u => u.username === username)) return null; // Already exists

  const newUser: User = {
    id: generateId(),
    username,
    role: UserRole.STUDENT,
    createdAt: Date.now(),
    aboutMe: ''
  };

  users.push(newUser);
  set(KEYS.USERS, users);
  set(KEYS.CURRENT_USER, newUser);
  return newUser;
};

export const logout = () => {
  localStorage.removeItem(KEYS.CURRENT_USER);
};

export const getCurrentUser = (): User | null => {
  return get<User | null>(KEYS.CURRENT_USER, null);
};

export const updateUserProfile = (userId: string, aboutMe: string) => {
  const users = get<User[]>(KEYS.USERS, []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx].aboutMe = aboutMe;
    set(KEYS.USERS, users);
    
    // Update session if it's the current user
    const current = getCurrentUser();
    if (current && current.id === userId) {
      current.aboutMe = aboutMe;
      set(KEYS.CURRENT_USER, current);
    }
  }
};

// --- Tasks ---
export const createTask = (task: Omit<Task, 'id' | 'createdAt'>): Task => {
  const tasks = get<Task[]>(KEYS.TASKS, []);
  const newTask: Task = {
    ...task,
    id: generateId(),
    createdAt: Date.now(),
    isArchived: false
  };
  tasks.unshift(newTask); // Add to top
  set(KEYS.TASKS, tasks);
  return newTask;
};

export const getTasks = (): Task[] => {
  return get<Task[]>(KEYS.TASKS, []);
};

export const getTaskById = (id: string): Task | undefined => {
  const tasks = get<Task[]>(KEYS.TASKS, []);
  return tasks.find(t => t.id === id);
};

export const deleteTask = (id: string) => {
  // 1. Delete the task
  let tasks = get<Task[]>(KEYS.TASKS, []);
  tasks = tasks.filter(t => t.id !== id);
  set(KEYS.TASKS, tasks);

  // 2. Delete associated submissions to ensure it's removed from student history
  let submissions = get<TaskSubmission[]>(KEYS.SUBMISSIONS, []);
  submissions = submissions.filter(s => s.taskId !== id);
  set(KEYS.SUBMISSIONS, submissions);
};

export const archiveTask = (id: string, isArchived: boolean = true) => {
  const tasks = get<Task[]>(KEYS.TASKS, []);
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx].isArchived = isArchived;
    set(KEYS.TASKS, tasks);
  }
};

export const updateTask = (id: string, updates: Partial<Task>) => {
    const tasks = get<Task[]>(KEYS.TASKS, []);
    const idx = tasks.findIndex(t => t.id === id);
    if(idx !== -1) {
        tasks[idx] = { ...tasks[idx], ...updates };
        set(KEYS.TASKS, tasks);
    }
}

// --- Submissions ---
export const submitTask = (submission: Omit<TaskSubmission, 'id' | 'submittedAt'>): TaskSubmission => {
  const submissions = get<TaskSubmission[]>(KEYS.SUBMISSIONS, []);
  
  // Calculate score automatically for objective types
  // Note: Free Text is calculated as 0 initially, marked as pending
  
  const newSubmission: TaskSubmission = {
    ...submission,
    id: generateId(),
    submittedAt: Date.now()
  };
  
  submissions.unshift(newSubmission);
  set(KEYS.SUBMISSIONS, submissions);
  return newSubmission;
};

export const getSubmissionsForTeacher = (): TaskSubmission[] => {
  return get<TaskSubmission[]>(KEYS.SUBMISSIONS, []);
};

export const getSubmissionsForStudent = (studentId: string): TaskSubmission[] => {
  const all = get<TaskSubmission[]>(KEYS.SUBMISSIONS, []);
  return all.filter(s => s.studentId === studentId);
};

export const updateSubmission = (id: string, updates: Partial<TaskSubmission>) => {
  const submissions = get<TaskSubmission[]>(KEYS.SUBMISSIONS, []);
  const idx = submissions.findIndex(s => s.id === id);
  if (idx !== -1) {
    submissions[idx] = { ...submissions[idx], ...updates };
    set(KEYS.SUBMISSIONS, submissions);
  }
};