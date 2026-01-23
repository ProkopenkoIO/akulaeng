import React, { useState, useRef, useEffect } from 'react';
import { TaskType, Task, MatchingPair, MediaAttachment } from '../../types';
import { createTask, updateTask } from '../../services/storage';
import { useLanguage } from '../../contexts/LanguageContext';

interface TaskCreatorProps {
  onClose: () => void;
  onCreated: () => void;
  initialTask?: Task;
}

const TaskCreator: React.FC<TaskCreatorProps> = ({ onClose, onCreated, initialTask }) => {
  const [type, setType] = useState<TaskType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<MediaAttachment | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  const { t } = useLanguage();
  
  // Specific Type States
  const [mcText, setMcText] = useState(''); // REPLACED: New Embedded MC Format
  
  // Keep MS separate as it's a checkbox list style
  const [msQuestion, setMsQuestion] = useState('');
  const [msOptions, setMsOptions] = useState(['', '', '']);
  const [msCorrect, setMsCorrect] = useState<number[]>([]);

  const [fbText, setFbText] = useState('');
  const [fbAnswers, setFbAnswers] = useState('');

  const [pairs, setPairs] = useState<MatchingPair[]>([{ id: '1', left: '', right: '' }]);

  const [catText, setCatText] = useState('');
  const [catNames, setCatNames] = useState('');

  const [tfContent, setTfContent] = useState('');

  const [orderContent, setOrderContent] = useState('');

  // Table State
  const [tableContent, setTableContent] = useState(''); // Stores HTML
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const [puzzleContent, setPuzzleContent] = useState(''); // Text if no image, or logic

  const [ftPrompt, setFtPrompt] = useState('');

  // Use From List
  const [uflList, setUflList] = useState('');
  const [uflText, setUflText] = useState('');

  // Initialize for Editing
  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setType(initialTask.type);
      setMedia(initialTask.media);
      
      const { content, correctAnswers } = initialTask;
      
      switch (initialTask.type) {
        case TaskType.MULTIPLE_CHOICE:
          // Check if it's the new text format or old question/options format
          if (content.text) {
             setMcText(content.text);
          } else {
             // Migration fallback (rare)
             setMcText(`${content.question}\n-1-(${content.options.map((o:string, i:number) => `${String.fromCharCode(97+i)}${i === correctAnswers ? '+' : ''}:${o}`).join('; ')};)`);
          }
          break;
        case TaskType.MULTIPLE_SELECT:
          setMsQuestion(content.question);
          setMsOptions(content.options);
          setMsCorrect(correctAnswers);
          break;
        case TaskType.FILL_IN_BLANKS:
          setFbText(content.text);
          if (correctAnswers) {
             const ansStr = Object.entries(correctAnswers).map(([k, v]) => `-${k}: ${v}`).join('\n');
             setFbAnswers(ansStr);
          }
          break;
        case TaskType.MATCHING:
          setPairs(content.pairs);
          break;
        case TaskType.CATEGORIZE:
          // Reconstruct Categories: { c1: "Fruit" } -> "c1:Fruit, ..."
          const catNameStr = Object.entries(content.categories || {}).map(([k,v]) => `${k}:${v}`).join(', ');
          setCatNames(catNameStr);
          // Reconstruct Text: items [ {id, text, categoryId} ] -> "c1(Text) ..."
          const catTextStr = (content.items || []).map((i: any) => `${i.categoryId}(${i.text})`).join(' ');
          setCatText(catTextStr);
          break;
        case TaskType.TRUE_FALSE:
          const tfStr = (content.statements || []).map((s: any) => `${s.isTrue ? 't' : 'f'}:${s.text}`).join('\n');
          setTfContent(tfStr);
          break;
        case TaskType.ORDER:
          // content.items [{text}]
          const orderStr = (content.items || []).map((i: any) => i.text).join(' && ');
          setOrderContent(orderStr);
          break;
        case TaskType.TABLE:
          setTableContent(content.html);
          break;
        case TaskType.PUZZLE:
          setPuzzleContent(content.text || '');
          break;
        case TaskType.FREE_TEXT:
          setFtPrompt(content.prompt);
          break;
        case TaskType.USE_FROM_LIST:
          setUflText(content.text);
          // Reconstruct list string: 1. Item; 2. Item;
          const listStr = Object.entries(correctAnswers || {}).map(([k,v]) => `${k}. ${v};`).join('\n');
          setUflList(listStr);
          break;
      }
    }
  }, [initialTask]);

  // Sync table content ref when opening edit
  useEffect(() => {
    if (type === TaskType.TABLE && tableRef.current && tableContent) {
      if (tableRef.current.innerHTML !== tableContent) {
        tableRef.current.innerHTML = tableContent;
      }
    }
  }, [type, tableContent]);


  // Media Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia({
          type: fileType,
          url: reader.result as string,
          sourceType: 'upload'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!title || !type) return;

    let content: any = {};
    let correctAnswers: any = {};

    switch (type) {
      case TaskType.MULTIPLE_CHOICE:
        // Parse the embedded format: -1-(a:..; b+:...;)
        // content = { text: rawText }
        // correctAnswers = { "1": "b", "2": "a" }
        const parsedAnswers: Record<string, string> = {};
        // Regex to find blocks: -(\d+)-\((.*?)\)
        const regex = /-(\d+)-\((.*?)\)/g;
        let match;
        while ((match = regex.exec(mcText)) !== null) {
            const questionId = match[1];
            const optionsStr = match[2];
            // Split options by semicolon
            const opts = optionsStr.split(';');
            opts.forEach(opt => {
                const optMatch = opt.match(/^\s*([a-z0-9]+)(\+?):/);
                if (optMatch && optMatch[2] === '+') {
                    parsedAnswers[questionId] = optMatch[1];
                }
            });
        }
        content = { text: mcText };
        correctAnswers = parsedAnswers;
        break;
      
      case TaskType.MULTIPLE_SELECT:
        // Filter out empty options
        const validOptions = msOptions.filter(o => o.trim() !== '');
        content = { question: msQuestion, options: validOptions };
        correctAnswers = msCorrect.filter(idx => idx < validOptions.length);
        break;

      case TaskType.FILL_IN_BLANKS:
        const answerMap: Record<string, string> = {};
        const lines = fbAnswers.split('\n');
        lines.forEach(line => {
          const m = line.match(/-(\d+):\s*(.+)/);
          if (m) {
            answerMap[m[1]] = m[2].trim();
          }
        });
        content = { text: fbText };
        correctAnswers = answerMap;
        break;
      
      case TaskType.MATCHING:
        content = { pairs };
        correctAnswers = null;
        break;

      case TaskType.CATEGORIZE:
         // Parsing c1:Name
         const categories: Record<string, string> = {};
         catNames.split(',').forEach(s => {
             const [id, name] = s.split(':');
             if(id && name) categories[id.trim()] = name.trim();
         });
         
         // Parsing items from text: c1(Apple)
         const items: {id: string, text: string, categoryId: string}[] = [];
         const catRegex = /(c\d+)\((.*?)\)/g;
         let cMatch;
         let idx = 0;
         while ((cMatch = catRegex.exec(catText)) !== null) {
            items.push({ id: `item-${idx++}`, text: cMatch[2], categoryId: cMatch[1] });
         }
         
         content = { categories, items };
         correctAnswers = items.map(i => ({ itemId: i.id, categoryId: i.categoryId }));
         break;

      case TaskType.TRUE_FALSE:
          const statements: {id: string, text: string, isTrue: boolean}[] = [];
          tfContent.split('\n').forEach((line, i) => {
              if (line.startsWith('t:')) statements.push({id: `tf-${i}`, text: line.substring(2), isTrue: true});
              if (line.startsWith('f:')) statements.push({id: `tf-${i}`, text: line.substring(2), isTrue: false});
          });
          content = { statements };
          correctAnswers = statements.map(s => ({ id: s.id, val: s.isTrue }));
          break;

      case TaskType.ORDER:
          const orderItems = orderContent.split('&&').map((s, i) => ({ id: `ord-${i}`, text: s.trim() }));
          content = { items: orderItems }; // Saved in correct order
          correctAnswers = orderItems.map(i => i.id);
          break;

      case TaskType.TABLE:
          // tableContent is the HTML string from contentEditable
          content = { html: tableContent };
          // We rely on runtime extraction in Taker for validation based on the prompt "tb:text".
          correctAnswers = null; 
          break;
      
      case TaskType.PUZZLE:
          content = { text: puzzleContent }; // If media exists, it uses media, else text
          correctAnswers = null; // Logic is algorithmic
          break;

      case TaskType.FREE_TEXT:
        content = { prompt: ftPrompt };
        correctAnswers = null;
        break;

      case TaskType.USE_FROM_LIST:
          // Parse List: 1. Item; 2. Item;
          const uflMap: Record<string, string> = {};
          const uflItems: string[] = [];
          uflList.split(';').forEach(seg => {
              const segTrim = seg.trim();
              const m = segTrim.match(/^(\d+)\.\s*(.+)/);
              if (m) {
                  uflMap[m[1]] = m[2].trim();
                  uflItems.push(m[2].trim());
              }
          });
          content = { text: uflText, list: uflItems };
          correctAnswers = uflMap;
          break;
    }

    const taskData = {
      title,
      description,
      type,
      content,
      correctAnswers,
      media
    };

    if (initialTask) {
        updateTask(initialTask.id, taskData);
    } else {
        createTask(taskData);
    }

    onCreated();
  };

  // Helper functions for Table Editor
  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (tableRef.current) {
        setTableContent(tableRef.current.innerHTML);
        tableRef.current.focus();
    }
  };

  const insertTable = () => {
    let html = '<table class="w-full border-collapse border border-gray-400 my-2">';
    for (let i = 0; i < tableRows; i++) {
      html += '<tr>';
      for (let j = 0; j < tableCols; j++) {
        html += '<td class="border border-gray-400 p-2 min-w-[50px]">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</table><br/>';
    execCmd('insertHTML', html);
  };

  const insertInputPlaceholder = () => {
    const answer = prompt(t('enter_answer_text') || "Enter correct answer:");
    if (answer) {
        // Insert as simple text for now, the taker parses "tb:..."
        execCmd('insertText', `tb:${answer} `);
    }
  };

  const getHelpContent = () => {
      switch(type) {
          case TaskType.MULTIPLE_CHOICE: return t('instr_mc');
          case TaskType.MULTIPLE_SELECT: return t('instr_ms');
          case TaskType.FILL_IN_BLANKS: return t('instr_fb');
          case TaskType.MATCHING: return t('instr_match');
          case TaskType.CATEGORIZE: return t('instr_cat');
          case TaskType.TRUE_FALSE: return t('instr_tf');
          case TaskType.ORDER: return t('instr_order');
          case TaskType.TABLE: return t('instr_table');
          case TaskType.PUZZLE: return t('instr_puzzle');
          case TaskType.FREE_TEXT: return t('instr_free');
          case TaskType.USE_FROM_LIST: return t('instr_ufl');
          default: return t('instr_general');
      }
  };

  const renderForm = () => {
    switch (type) {
      case TaskType.MULTIPLE_CHOICE:
        return (
          <div className="space-y-4">
             <label className="block text-sm font-medium text-gray-700">{t('task_text_label')}</label>
             <p className="text-xs text-gray-500 whitespace-pre-line">{t('instr_mc')}</p>
             <textarea 
                className="w-full p-2 border rounded h-40 font-mono text-sm"
                value={mcText}
                onChange={e => setMcText(e.target.value)}
                placeholder={t('task_text_placeholder')}
             />
          </div>
        );
      
      case TaskType.MULTIPLE_SELECT:
        return (
          <div className="space-y-4">
            <input
              placeholder={t('question')}
              className="w-full p-2 border rounded"
              value={msQuestion}
              onChange={e => setMsQuestion(e.target.value)}
            />
            {msOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="checkbox"
                  name="correct"
                  checked={msCorrect.includes(idx)}
                  onChange={() => {
                      if (msCorrect.includes(idx)) setMsCorrect(msCorrect.filter(i => i !== idx));
                      else setMsCorrect([...msCorrect, idx]);
                  }}
                />
                <input
                  placeholder={`${t('option')} ${String.fromCharCode(65 + idx)}`}
                  className="w-full p-2 border rounded"
                  value={opt}
                  onChange={e => {
                    const newOpts = [...msOptions];
                    newOpts[idx] = e.target.value;
                    setMsOptions(newOpts);
                  }}
                />
              </div>
            ))}
            {msOptions.length < 10 && (
                <button onClick={() => setMsOptions([...msOptions, ''])} className="text-sm text-indigo-600">
                    + Add Option
                </button>
            )}
          </div>
        );
      
      case TaskType.FILL_IN_BLANKS:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('task_text_label')}</label>
              <textarea
                className="w-full p-2 border rounded h-32"
                value={fbText}
                onChange={e => setFbText(e.target.value)}
                placeholder={t('task_text_placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('answers_label')}</label>
              <textarea
                className="w-full p-2 border rounded h-32"
                value={fbAnswers}
                onChange={e => setFbAnswers(e.target.value)}
                placeholder={t('answers_placeholder')}
              />
            </div>
          </div>
        );

      case TaskType.MATCHING:
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">{t('matching_instruction')}</p>
            {pairs.map((pair, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  placeholder={t('left_item')}
                  className="w-1/2 p-2 border rounded"
                  value={pair.left}
                  onChange={e => {
                    const newPairs = [...pairs];
                    newPairs[idx].left = e.target.value;
                    setPairs(newPairs);
                  }}
                />
                <span>↔</span>
                <input
                  placeholder={t('right_item')}
                  className="w-1/2 p-2 border rounded"
                  value={pair.right}
                  onChange={e => {
                    const newPairs = [...pairs];
                    newPairs[idx].right = e.target.value;
                    setPairs(newPairs);
                  }}
                />
                <button
                  onClick={() => setPairs(pairs.filter((_, i) => i !== idx))}
                  className="text-red-500 px-2"
                >✕</button>
              </div>
            ))}
            {pairs.length < 50 && (
                <button
                  onClick={() => setPairs([...pairs, { id: Math.random().toString(), left: '', right: '' }])}
                  className="text-indigo-600 text-sm font-medium hover:underline"
                >
                  {t('add_pair')}
                </button>
            )}
          </div>
        );

      case TaskType.CATEGORIZE:
          return (
            <div className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700">Categories (ID:Name)</label>
                   <input 
                      className="w-full p-2 border rounded"
                      value={catNames} 
                      onChange={e => setCatNames(e.target.value)}
                      placeholder={t('cat_name_hint')}
                   />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Content</label>
                    <textarea 
                        className="w-full p-2 border rounded h-32"
                        value={catText}
                        onChange={e => setCatText(e.target.value)}
                        placeholder={t('cat_text_hint')}
                    />
                </div>
            </div>
          );

      case TaskType.TRUE_FALSE:
          return (
             <div>
                <label className="block text-sm font-medium text-gray-700">Statements (One per line)</label>
                <textarea 
                    className="w-full p-2 border rounded h-40"
                    value={tfContent}
                    onChange={e => setTfContent(e.target.value)}
                    placeholder={t('tf_hint')}
                />
             </div>
          );

      case TaskType.ORDER:
          return (
             <div>
                <label className="block text-sm font-medium text-gray-700">Items (In Correct Order)</label>
                <textarea 
                    className="w-full p-2 border rounded h-32"
                    value={orderContent}
                    onChange={e => setOrderContent(e.target.value)}
                    placeholder={t('order_hint')}
                />
             </div>
          );

      case TaskType.TABLE:
          return (
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('table_hint')}</label>
                
                {/* Editor Toolbar */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border border-gray-300 rounded-t-lg text-sm">
                   <button onClick={() => execCmd('bold')} className="font-bold px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Bold">B</button>
                   <button onClick={() => execCmd('italic')} className="italic px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Italic">I</button>
                   <button onClick={() => execCmd('underline')} className="underline px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Underline">U</button>
                   <div className="w-px h-5 bg-gray-300 mx-1"></div>
                   <button onClick={() => execCmd('justifyLeft')} className="px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Align Left">L</button>
                   <button onClick={() => execCmd('justifyCenter')} className="px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Align Center">C</button>
                   <button onClick={() => execCmd('justifyRight')} className="px-2 py-1 hover:bg-gray-200 rounded text-gray-700" title="Align Right">R</button>
                   <div className="w-px h-5 bg-gray-300 mx-1"></div>
                   <div className="flex items-center gap-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 leading-none">{t('rows')}</span>
                        <input type="number" min="1" max="10" value={tableRows} onChange={e => setTableRows(parseInt(e.target.value))} className="w-10 p-0.5 border rounded text-xs"/>
                      </div>
                      <span className="text-gray-400">x</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 leading-none">{t('cols')}</span>
                        <input type="number" min="1" max="10" value={tableCols} onChange={e => setTableCols(parseInt(e.target.value))} className="w-10 p-0.5 border rounded text-xs"/>
                      </div>
                      <button onClick={insertTable} className="ml-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                         {t('insert_table')}
                      </button>
                   </div>
                   <div className="w-px h-5 bg-gray-300 mx-1"></div>
                   <button onClick={insertInputPlaceholder} className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                      {t('insert_input')}
                   </button>
                </div>

                <div 
                   ref={tableRef}
                   className="w-full p-4 border border-t-0 border-gray-300 rounded-b-lg h-64 overflow-auto focus:outline-none prose max-w-none"
                   contentEditable
                   onInput={() => setTableContent(tableRef.current?.innerHTML || '')}
                   style={{ minHeight: '200px' }}
                />
             </div>
          );

      case TaskType.PUZZLE:
          return (
             <div>
                 <p className="text-sm text-gray-500 mb-2">If an image is uploaded above, it will be used for the puzzle. Otherwise, enter text below to be scrambled.</p>
                 <textarea 
                    className="w-full p-2 border rounded h-20"
                    value={puzzleContent}
                    onChange={e => setPuzzleContent(e.target.value)}
                    placeholder="Enter text to puzzle..."
                 />
             </div>
          );

      case TaskType.FREE_TEXT:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('prompt_label')}</label>
            <textarea
              className="w-full p-2 border rounded h-32"
              value={ftPrompt}
              onChange={e => setFtPrompt(e.target.value)}
              placeholder={t('prompt_placeholder')}
            />
          </div>
        );
      
      case TaskType.USE_FROM_LIST:
          return (
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">{t('list_items_label')}</label>
                      <textarea 
                          className="w-full p-2 border rounded h-32"
                          value={uflList}
                          onChange={e => setUflList(e.target.value)}
                          placeholder={t('list_items_placeholder')}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">{t('task_text_label')}</label>
                      <textarea 
                          className="w-full p-2 border rounded h-40"
                          value={uflText}
                          onChange={e => setUflText(e.target.value)}
                          placeholder={t('task_text_placeholder')}
                      />
                  </div>
              </div>
          );
      
      default:
        return <div className="text-gray-400 italic">{t('select_type_hint')}</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
             <h2 className="text-2xl font-bold text-gray-800">{initialTask ? t('edit_task') : t('create_new_task')}</h2>
             {type && (
                 <button 
                   onClick={() => setShowHelp(true)} 
                   className="p-1 rounded-full text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600 transition"
                   title={t('how_to_create')}
                 >
                     <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6c0 3.61 2.46 6.66 5.86 7.64.48.14.71.66.52 1.13l-.26.65a1 1 0 00.93 1.37h.9a1 1 0 00.93-1.37l-.26-.65a.99.99 0 01.52-1.13C13.54 14.66 16 11.61 16 8a6 6 0 00-6-6zm1 10h-2v-1h2v1zm0-2h-2V6h2v4z"/></svg>
                 </button>
             )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('title')}</label>
              <input
                className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('title_placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('type')}</label>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={type}
                disabled={!!initialTask}
                onChange={e => setType(e.target.value as TaskType)}
              >
                <option value="">{t('select_type')}</option>
                <option value={TaskType.MULTIPLE_CHOICE}>{t('type_mc')}</option>
                <option value={TaskType.MULTIPLE_SELECT}>{t('type_ms')}</option>
                <option value={TaskType.FILL_IN_BLANKS}>{t('type_fb')}</option>
                <option value={TaskType.MATCHING}>{t('type_match')}</option>
                <option value={TaskType.CATEGORIZE}>{t('type_cat')}</option>
                <option value={TaskType.TRUE_FALSE}>{t('type_tf')}</option>
                <option value={TaskType.ORDER}>{t('type_order')}</option>
                <option value={TaskType.TABLE}>{t('type_table')}</option>
                <option value={TaskType.PUZZLE}>{t('type_puzzle')}</option>
                <option value={TaskType.FREE_TEXT}>{t('type_free')}</option>
                <option value={TaskType.USE_FROM_LIST}>{t('type_ufl')}</option>
              </select>
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
             <input
                className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
              />
          </div>

          {/* Media Section */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-2">{t('add_media')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <input 
                         className="w-full p-2 border rounded text-sm mb-2" 
                         placeholder={t('media_url_placeholder')}
                         onChange={(e) => setMedia({ type: e.target.value.includes('youtube') ? 'video' : 'image', url: e.target.value, sourceType: 'url' })}
                         value={media?.sourceType === 'url' ? media.url : ''}
                      />
                  </div>
                  <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer bg-white border border-gray-300 rounded p-2 text-center text-sm hover:bg-gray-100">
                          {t('upload_image')}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
                      </label>
                      <label className="flex-1 cursor-pointer bg-white border border-gray-300 rounded p-2 text-center text-sm hover:bg-gray-100">
                          {t('upload_audio')}
                          <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} />
                      </label>
                  </div>
              </div>
              {media && (
                  <div className="mt-2 text-xs text-green-600 font-medium">
                      Media attached: {media.type} ({media.sourceType})
                  </div>
              )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{t('task_content')}</h3>
            {renderForm()}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">{t('cancel')}</button>
          <button
            onClick={handleSave}
            disabled={!type || !title}
            className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {initialTask ? t('update_task') : t('create_task')}
          </button>
        </div>
      </div>

      {/* Instruction Modal */}
      {showHelp && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full relative">
                  <button onClick={() => setShowHelp(false)} className="absolute top-2 right-3 text-gray-400 hover:text-gray-600">✕</button>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                     <span className="text-yellow-500">💡</span> {t('how_to_create')}
                  </h3>
                  <div className="space-y-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      <p className="font-semibold">{t('instr_general')}</p>
                      <hr />
                      <p>{getHelpContent()}</p>
                  </div>
                  <button onClick={() => setShowHelp(false)} className="mt-6 w-full bg-indigo-100 text-indigo-700 py-2 rounded hover:bg-indigo-200">
                      Got it
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default TaskCreator;