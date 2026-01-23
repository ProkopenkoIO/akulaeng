import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { getCurrentUser, logout } from './services/storage';
import AuthPage from './components/auth/AuthPage';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import StudentDashboard from './components/student/StudentDashboard';
import { useLanguage } from './contexts/LanguageContext';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  // Language Switcher Component
  const LanguageSwitcher = () => (
    <div className="flex items-center gap-2 mr-2 sm:mr-4">
      <button 
        onClick={() => setLanguage('en')} 
        className={`px-2 py-1 rounded text-sm transition ${language === 'en' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button 
        onClick={() => setLanguage('uk')} 
        className={`px-2 py-1 rounded text-sm transition ${language === 'uk' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
      >
        UA
      </button>
    </div>
  );

  if (loading) return <div className="h-screen flex items-center justify-center text-indigo-600">Loading...</div>;

  if (!user) {
    return (
      <>
        <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <AuthPage onLogin={setUser} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                LinguaFlow
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSwitcher />
              
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role === UserRole.TEACHER ? t('role_teacher') : t('role_student')}
                </p>
              </div>
              <button 
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-600 transition p-2"
                title={t('logout')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-6">
        {user.role === UserRole.TEACHER ? (
          <TeacherDashboard />
        ) : (
          <StudentDashboard user={user} />
        )}
      </main>
    </div>
  );
};

export default App;