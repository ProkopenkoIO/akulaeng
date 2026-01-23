import React, { useState, useEffect } from 'react';
import { User, Task, TaskSubmission, TaskType } from '../../types';
import { getTasks, getSubmissionsForStudent, submitTask, updateUserProfile, getTaskById } from '../../services/storage';
import TaskTaker from './TaskTaker';
import { useLanguage } from '../../contexts/LanguageContext';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [aboutMe, setAboutMe] = useState(user.aboutMe || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [searchId, setSearchId] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    refreshData();
  }, [user.id]);

  const refreshData = () => {
    // Filter out archived tasks for student view
    const allTasks = getTasks();
    setTasks(allTasks.filter(t => !t.isArchived));
    setSubmissions(getSubmissionsForStudent(user.id));
  };

  const handleTaskSubmit = (answers: any, score: number) => {
    if (!activeTask) return;

    submitTask({
      taskId: activeTask.id,
      studentId: user.id,
      studentName: user.username,
      taskTitle: activeTask.title,
      answers,
      score,
      status: activeTask.type === 'free_text' ? 'pending' : 'graded'
    });

    setActiveTask(null);
    refreshData();
    alert(`${t('task_completed')} ${t('result')}: ${activeTask.type === 'free_text' ? t('pending_review_score') : score + '%'}`);
  };

  const handleSaveProfile = () => {
    updateUserProfile(user.id, aboutMe);
    setIsEditingProfile(false);
  };

  const handleSearch = () => {
    if (!searchId) return;
    const task = getTaskById(searchId);
    if (task && !task.isArchived) {
      setActiveTask(task);
      setSearchId('');
    } else {
      alert(t('task_not_found'));
    }
  };

  const averageScore = submissions.length > 0
    ? Math.round(submissions.reduce((acc, curr) => acc + curr.score, 0) / submissions.length)
    : 0;
  
  const getTaskTypeLabel = (type: TaskType) => {
    switch (type) {
      case TaskType.MULTIPLE_CHOICE: return t('type_mc');
      case TaskType.FILL_IN_BLANKS: return t('type_fb');
      case TaskType.MATCHING: return t('type_match');
      case TaskType.FREE_TEXT: return t('type_free');
      case TaskType.USE_FROM_LIST: return t('type_ufl');
      default: return type;
    }
  };

  if (activeTask) {
    return <TaskTaker task={activeTask} onSubmit={handleTaskSubmit} onCancel={() => setActiveTask(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Profile Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-1/3 text-center md:text-left">
          <div className="inline-block p-1 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 mb-4">
             <img src={`https://picsum.photos/seed/${user.username}/150/150`} alt="Profile" className="w-32 h-32 rounded-full border-4 border-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{user.username}</h1>
          <p className="text-gray-500 text-sm">{t('student')}</p>
          
          <div className="mt-6 bg-indigo-50 rounded-xl p-4">
             <span className="block text-3xl font-bold text-indigo-600">{averageScore}%</span>
             <span className="text-xs text-indigo-800 uppercase font-semibold tracking-wide">{t('average_score')}</span>
          </div>
        </div>
        
        <div className="w-full md:w-2/3">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">{t('about_me')}</h2>
            <button 
              onClick={() => isEditingProfile ? handleSaveProfile() : setIsEditingProfile(true)}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              {isEditingProfile ? t('save') : t('edit')}
            </button>
          </div>
          {isEditingProfile ? (
            <textarea
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              rows={4}
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              placeholder="Tell us about yourself..."
            />
          ) : (
            <p className="text-gray-600 leading-relaxed">{aboutMe || t('no_bio')}</p>
          )}
        </div>
      </div>

      {/* Available Tasks & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Available Tasks List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">{t('available_tasks')}</h2>
            <div className="flex gap-2">
              <input 
                placeholder={t('find_by_id')}
                className="border rounded-lg px-3 py-1 text-sm focus:border-indigo-500 outline-none"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
              />
              <button onClick={handleSearch} className="bg-gray-800 text-white px-3 py-1 rounded-lg text-sm">{t('go')}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map(task => {
                const isCompleted = submissions.some(s => s.taskId === task.id);
                return (
                  <div key={task.id} className={`bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col ${isCompleted ? 'opacity-75 bg-gray-50' : 'hover:shadow-md transition'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-indigo-500 uppercase">{getTaskTypeLabel(task.type)}</span>
                      {isCompleted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t('done')}</span>}
                    </div>
                    <h3 className="font-bold text-gray-800 mb-1">{task.title}</h3>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{task.description}</p>
                    <div className="mt-auto pt-4 border-t border-gray-50 flex justify-between items-center">
                       <span className="text-xs text-gray-400">ID: {task.id}</span>
                       {!isCompleted && (
                         <button 
                           onClick={() => setActiveTask(task)}
                           className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 transition"
                         >
                           {t('start')}
                         </button>
                       )}
                    </div>
                  </div>
                );
            })}
            {tasks.length === 0 && <div className="text-gray-400">{t('no_tasks_available')}</div>}
          </div>
        </div>

        {/* History Sidebar */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('history')}</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {submissions.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">{t('no_history')}</div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {submissions.map(sub => (
                        <div key={sub.id} className="p-4 hover:bg-gray-50 transition">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-gray-800 text-sm">{sub.taskTitle}</span>
                                <span className={`font-bold text-sm ${sub.score >= 80 ? 'text-green-600' : 'text-orange-500'}`}>{sub.score}%</span>
                            </div>
                            {sub.teacherComment && (
                                <div className="mt-2 text-xs bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-100">
                                    <span className="font-bold">{t('teacher_comment')}:</span> {sub.teacherComment}
                                </div>
                            )}
                            <div className="mt-2 text-xs text-gray-400 text-right">
                                {new Date(sub.submittedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;