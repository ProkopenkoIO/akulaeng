import React, { useState, useEffect } from 'react';
import { Task, TaskSubmission, TaskType } from '../../types';
import { getTasks, getSubmissionsForTeacher, archiveTask, updateSubmission } from '../../services/storage';
import TaskCreator from './TaskCreator';
import { useLanguage } from '../../contexts/LanguageContext';

const TeacherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'submissions'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'active' | 'archived'>('active');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [viewingSubmission, setViewingSubmission] = useState<TaskSubmission | null>(null);
  const [comment, setComment] = useState('');
  const [scoreOverride, setScoreOverride] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setTasks(getTasks());
    setSubmissions(getSubmissionsForTeacher());
  };

  const handleArchiveTask = (id: string, isArchived: boolean) => {
    // Instant archive without confirmation
    archiveTask(id, isArchived);
    refreshData();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowCreator(true);
  };

  const handleCloseCreator = () => {
    setShowCreator(false);
    setEditingTask(undefined);
  };

  const handleGradeSubmission = () => {
    if (!viewingSubmission) return;
    
    const updates: Partial<TaskSubmission> = {
      teacherComment: comment,
      status: 'graded'
    };

    if (scoreOverride !== '') {
      updates.score = parseInt(scoreOverride);
    }

    updateSubmission(viewingSubmission.id, updates);
    setViewingSubmission(null);
    setComment('');
    setScoreOverride('');
    refreshData();
  };

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

  const filteredTasks = tasks.filter(t => taskFilter === 'active' ? !t.isArchived : t.isArchived);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('teacher_dashboard')}</h1>
          <p className="text-gray-500 mt-1">{t('manage_tasks_subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreator(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 shadow-md transition flex items-center gap-2"
        >
          <span className="text-xl">+</span> {t('create_task')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-2 font-medium transition ${activeTab === 'tasks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {t('my_tasks')}
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 px-2 font-medium transition ${activeTab === 'submissions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {t('student_submissions')}
        </button>
      </div>

      {activeTab === 'tasks' ? (
        <div className="space-y-4">
          <div className="flex gap-2">
              <button 
                onClick={() => setTaskFilter('active')} 
                className={`px-3 py-1 rounded-full text-xs font-semibold ${taskFilter === 'active' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  {t('active_tasks')}
              </button>
              <button 
                onClick={() => setTaskFilter('archived')} 
                className={`px-3 py-1 rounded-full text-xs font-semibold ${taskFilter === 'archived' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  {t('archived_tasks')}
              </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map(task => (
                <div key={task.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition ${task.isArchived ? 'opacity-70 bg-gray-50' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium uppercase">{getTaskTypeLabel(task.type)}</span>
                    <span className="text-xs text-gray-400">ID: {task.id}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{task.title}</h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">{task.description}</p>
                
                <div className="flex gap-2 mt-auto pt-4 border-t border-gray-50">
                    <button 
                    onClick={() => handleEditTask(task)}
                    className="p-2 text-gray-400 hover:text-blue-600" 
                    title="Edit"
                    >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    {task.isArchived ? (
                        <button onClick={() => handleArchiveTask(task.id, false)} className="p-2 text-gray-400 hover:text-green-600" title={t('unarchive')}>
                            {/* Up arrow coming out of box */}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                        </button>
                    ) : (
                        <button onClick={() => handleArchiveTask(task.id, true)} className="p-2 text-gray-400 hover:text-red-600" title={t('archive')}>
                            {/* Down arrow going into box */}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        </button>
                    )}
                </div>
                </div>
            ))}
            {filteredTasks.length === 0 && <div className="col-span-full text-center py-10 text-gray-400">{t('no_tasks_created')}</div>}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">{t('student')}</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">{t('task')}</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">{t('result')}</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm">{t('status')}</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-800">{sub.studentName}</td>
                  <td className="px-6 py-4 text-gray-600">{sub.taskTitle}</td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${sub.score >= 80 ? 'text-green-600' : sub.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {sub.score}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {sub.status === 'pending' ? (
                       <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">{t('pending_review')}</span>
                    ) : (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{t('graded')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setViewingSubmission(sub);
                        setComment(sub.teacherComment || '');
                        setScoreOverride(sub.score.toString());
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      {t('review')}
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">{t('no_submissions')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreator && (
        <TaskCreator 
          onClose={handleCloseCreator} 
          onCreated={() => { handleCloseCreator(); refreshData(); }} 
          initialTask={editingTask}
        />
      )}

      {/* Review Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
             <h3 className="text-xl font-bold mb-4">{t('review_submission')}</h3>
             <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm space-y-2">
                <p><span className="font-semibold">{t('student')}:</span> {viewingSubmission.studentName}</p>
                <p><span className="font-semibold">{t('task')}:</span> {viewingSubmission.taskTitle}</p>
                <p><span className="font-semibold">{t('current_score')}:</span> {viewingSubmission.score}%</p>
                <div className="pt-2 border-t border-gray-200 mt-2">
                    <p className="font-semibold mb-1">{t('answers')}:</p>
                    <pre className="whitespace-pre-wrap bg-white p-2 rounded border text-xs overflow-auto max-h-40">
                      {JSON.stringify(viewingSubmission.answers, null, 2)}
                    </pre>
                </div>
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">{t('adjust_score')}</label>
                 <input 
                    type="number" 
                    min="0" max="100"
                    value={scoreOverride}
                    onChange={(e) => setScoreOverride(e.target.value)}
                    className="w-full p-2 border rounded"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">{t('teacher_comment')}</label>
                 <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-2 border rounded h-24"
                    placeholder={t('teacher_comment_placeholder')}
                 />
               </div>
             </div>

             <div className="flex justify-end gap-3 mt-6">
               <button onClick={() => setViewingSubmission(null)} className="text-gray-500 hover:bg-gray-100 px-4 py-2 rounded">{t('cancel')}</button>
               <button onClick={handleGradeSubmission} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">{t('save_grade')}</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;