import React, { useState, useEffect } from 'react';
import { Task, TaskType, MatchingPair } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface TaskTakerProps {
  task: Task;
  onSubmit: (answers: any, score: number) => void;
  onCancel: () => void;
}

// Memoized Table Component to prevent re-rendering inputs on keystroke
const TableRenderer = React.memo(({ html, onInputChange }: { html: string, onInputChange: (key: string, value: string) => void }) => {
  const processedHtml = React.useMemo(() => {
      // Use offset to create unique keys for inputs corresponding to their position in HTML
      return html.replace(/tb:(.+?)(?=<|\s|&nbsp;)/g, (match, p1, offset) => {
          return `<input class="border-b border-indigo-500 bg-transparent px-1 w-24 text-center outline-none table-input" data-key="tbl-${offset}" placeholder="?" />`;
      });
  }, [html]);

  return (
      <div className="overflow-auto border rounded p-4 bg-gray-50">
         <div className="prose max-w-none">
             <div 
                dangerouslySetInnerHTML={{ __html: processedHtml }} 
                onInput={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.classList.contains('table-input')) {
                        const key = target.getAttribute('data-key');
                        if(key) onInputChange(key, target.value);
                    }
                }}
             />
         </div>
      </div>
  );
}, (prev, next) => prev.html === next.html);

const TaskTaker: React.FC<TaskTakerProps> = ({ task, onSubmit, onCancel }) => {
  const { t } = useLanguage();

  // --- States ---
  
  // MC (Embedded)
  const [mcInputs, setMcInputs] = useState<Record<string, string>>({});

  // Multiple Select
  const [msSelected, setMsSelected] = useState<number[]>([]);

  // Fill Blanks
  const [fbInputs, setFbInputs] = useState<Record<string, string>>({});
  
  // Matching
  const [matchState, setMatchState] = useState<{
    leftSelected: string | null;
    connections: Record<string, string>;
  }>({ leftSelected: null, connections: {} });

  // Categorize
  const [catState, setCatState] = useState<Record<string, string>>({}); // ItemId -> CategoryId

  // True/False
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean | null>>({});

  // Order
  const [orderItems, setOrderItems] = useState<{id: string, text: string}[]>([]);

  // Table
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({});

  // Puzzle (Simple Tile Swap)
  const [puzzleTiles, setPuzzleTiles] = useState<number[]>([]); // Array of indices 0..8
  const [puzzleSolved, setPuzzleSolved] = useState(false);

  // Free Text
  const [ftText, setFtText] = useState('');
  
  // Use From List
  const [uflInputs, setUflInputs] = useState<Record<string, string>>({});
  const [uflBank, setUflBank] = useState<string[]>([]);


  // --- Initialization ---
  useEffect(() => {
      // Shuffle Order items
      if (task.type === TaskType.ORDER) {
          const items = [...task.content.items];
          for (let i = items.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [items[i], items[j]] = [items[j], items[i]];
          }
          setOrderItems(items);
      }
      // Init Puzzle
      if (task.type === TaskType.PUZZLE) {
          const tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8];
           // Simple shuffle
          for (let i = tiles.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
          }
          setPuzzleTiles(tiles);
      }
      // Init Use From List Bank
      if (task.type === TaskType.USE_FROM_LIST) {
          const items = [...(task.content.list || [])];
          // Shuffle bank
          for (let i = items.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [items[i], items[j]] = [items[j], items[i]];
          }
          setUflBank(items);
      }
  }, [task]);


  // --- Logic ---

  const calculateScore = (): number => {
    if (task.type === TaskType.MULTIPLE_CHOICE) {
      // Correct answers are stored as { "1": "a", "2": "b" }
      const correctMap = task.correctAnswers as Record<string, string>;
      const total = Object.keys(correctMap).length;
      if (total === 0) return 0;
      let correctCount = 0;
      Object.entries(correctMap).forEach(([key, val]) => {
         if (mcInputs[key] === val) correctCount++;
      });
      return Math.round((correctCount / total) * 100);
    }

    if (task.type === TaskType.MULTIPLE_SELECT) {
        const correct = task.correctAnswers as number[];
        // Basic logic: all correct must be selected, no extra.
        // Or partial credit. Let's do partial credit normalized to 100.
        // If you select wrong one, penalty? Let's keep it simple: matches / total_correct
        const userSet = new Set(msSelected);
        const correctSet = new Set(correct);
        let hits = 0;
        let wrongs = 0;
        msSelected.forEach(i => {
            if (correctSet.has(i)) hits++;
            else wrongs++;
        });
        
        // Custom simple scoring: (hits - wrongs) / total_correct
        if (correct.length === 0) return 0;
        const raw = (hits - wrongs) / correct.length;
        return Math.max(0, Math.round(raw * 100));
    }
    
    if (task.type === TaskType.FILL_IN_BLANKS) {
      const correctMap = task.correctAnswers as Record<string, string>;
      const total = Object.keys(correctMap).length;
      if (total === 0) return 0;
      let correctCount = 0;
      
      Object.entries(correctMap).forEach(([key, val]) => {
        // Handle alternatives ::
        const valStr = val || "";
        const alternatives = valStr.split('::').map(s => s.trim().toLowerCase());
        const userVal = fbInputs[key]?.trim().toLowerCase();
        if (alternatives.includes(userVal)) {
          correctCount++;
        }
      });
      return Math.round((correctCount / total) * 100);
    }

    if (task.type === TaskType.MATCHING) {
      const pairs = task.content.pairs as MatchingPair[];
      const total = pairs.length;
      if(total === 0) return 0;
      let correct = 0;
      pairs.forEach(p => {
        if (matchState.connections[p.id] === p.id) correct++;
      });
      return Math.round((correct / total) * 100);
    }

    if (task.type === TaskType.CATEGORIZE) {
        const items = task.content.items;
        const total = items.length;
        if (total === 0) return 0;
        let correct = 0;
        items.forEach((item: any) => {
            if (catState[item.id] === item.categoryId) correct++;
        });
        return Math.round((correct / total) * 100);
    }

    if (task.type === TaskType.TRUE_FALSE) {
        const stats = task.content.statements;
        const total = stats.length;
        if (total === 0) return 0;
        let correct = 0;
        stats.forEach((s: any) => {
             // Comparing with answers derived from creation
             // task.correctAnswers is [{id, val}]
             const rightVal = task.correctAnswers.find((a:any) => a.id === s.id)?.val;
             if (tfAnswers[s.id] === rightVal) correct++;
        });
        return Math.round((correct / total) * 100);
    }

    if (task.type === TaskType.ORDER) {
        // Compare ids array
        const correctOrder = task.correctAnswers as string[];
        const userOrder = orderItems.map(i => i.id);
        if (JSON.stringify(correctOrder) === JSON.stringify(userOrder)) return 100;
        return 0; // Strict ordering
    }

    if (task.type === TaskType.TABLE) {
        const regex = /tb:(.+?)(?=<|\s|&nbsp;)/g;
        let match;
        let correct = 0;
        let total = 0;
        const tempHtml = task.content.html;
        
        while ((match = regex.exec(tempHtml)) !== null) {
            const expected = match[1].trim().toLowerCase();
            const offset = match.index;
            const user = tableInputs[`tbl-${offset}`]?.trim().toLowerCase();
            if (expected === user) correct++;
            total++;
        }
        if (total === 0) return 0;
        return Math.round((correct / total) * 100);
    }

    if (task.type === TaskType.PUZZLE) {
        // Check if sorted 0..8
        for(let i=0; i<puzzleTiles.length; i++) {
            if (puzzleTiles[i] !== i) return 0;
        }
        return 100;
    }

    if (task.type === TaskType.USE_FROM_LIST) {
        const correctMap = task.correctAnswers as Record<string, string>;
        const total = Object.keys(correctMap).length;
        if (total === 0) return 0;
        let correctCount = 0;
        Object.entries(correctMap).forEach(([key, val]) => {
           if (uflInputs[key]?.trim().toLowerCase() === val.trim().toLowerCase()) correctCount++;
        });
        return Math.round((correctCount / total) * 100);
    }

    if (task.type === TaskType.FREE_TEXT) return 0;

    return 0;
  };

  const handleSubmit = () => {
    let answers: any = {};
    const score = calculateScore();

    // Collect answers based on type for persistence
    switch (task.type) {
        case TaskType.MULTIPLE_CHOICE: answers = mcInputs; break;
        case TaskType.MULTIPLE_SELECT: answers = { selectedIndices: msSelected }; break;
        case TaskType.FILL_IN_BLANKS: answers = fbInputs; break;
        case TaskType.MATCHING: answers = matchState.connections; break;
        case TaskType.CATEGORIZE: answers = catState; break;
        case TaskType.TRUE_FALSE: answers = tfAnswers; break;
        case TaskType.ORDER: answers = orderItems.map(i => i.id); break;
        case TaskType.TABLE: answers = tableInputs; break;
        case TaskType.PUZZLE: answers = puzzleTiles; break;
        case TaskType.FREE_TEXT: answers = { text: ftText }; break;
        case TaskType.USE_FROM_LIST: answers = uflInputs; break;
    }

    onSubmit(answers, score);
  };

  // --- Renderers ---

  const renderMedia = () => {
      if (!task.media) return null;
      return (
          <div className="mb-6 flex justify-center bg-gray-900 rounded-lg overflow-hidden">
              {task.media.type === 'image' && (
                  <img src={task.media.url} alt="Task Media" className="max-h-80 object-contain" />
              )}
              {task.media.type === 'video' && task.media.sourceType === 'url' && (
                  <iframe 
                    width="100%" height="400" 
                    src={task.media.url.replace('watch?v=', 'embed/')} 
                    title="Video" frameBorder="0" allowFullScreen 
                  />
              )}
              {task.media.type === 'audio' && (
                  <audio controls src={task.media.url} className="w-full mt-2" />
              )}
          </div>
      );
  };

  const renderMC = () => {
      // New logic for Embedded MC
      const text = task.content.text || "";
      // Split by question markers like -1-(options)
      // Regex: /(-(\d+)-\((.*?)\))/g
      // We need to keep delimiters to render interaction points
      
      const parts = text.split(/(-(\d+)-\(.*?\))/g);
      
      return (
          <div className="text-lg leading-loose text-gray-800 whitespace-pre-wrap">
              {parts.map((part: string, idx: number) => {
                  // Check if part matches the full block regex
                  if (part.match(/^-(\d+)-\((.*?)\)$/)) {
                      const match = part.match(/^-(\d+)-\((.*?)\)$/);
                      if (!match) return null;
                      const id = match[1];
                      const optionsStr = match[2];
                      // Parse options: a:Answer; b:Answer
                      const options: {key: string, label: string}[] = [];
                      optionsStr.split(';').forEach(o => {
                          const oMatch = o.match(/^\s*([a-z0-9]+)\+?:(.*)/);
                          if(oMatch) {
                              options.push({ key: oMatch[1], label: oMatch[2].trim() });
                          }
                      });

                      return (
                          <span key={idx} className="mx-1 inline-block">
                              <select 
                                className="border-b-2 border-indigo-500 bg-indigo-50/50 text-indigo-900 py-1 px-2 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                value={mcInputs[id] || ''}
                                onChange={(e) => setMcInputs(prev => ({ ...prev, [id]: e.target.value }))}
                              >
                                  <option value="">{t('select_option')}</option>
                                  {options.map(opt => (
                                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                                  ))}
                              </select>
                          </span>
                      );
                  }
                  // Skip the capturing groups from split that are just digits or inner content if they are standalone
                  // But wait, split with capturing groups includes them in the array.
                  // If part is just a digit or inner content that was captured, ignore it if it doesn't match the full structure?
                  // Actually, split(regex) returns [text, id, inner, text, id, inner...]
                  // The loop iterates all.
                  if (part.match(/^\d+$/)) return null; // ID capture
                  if (part.includes(';') && !part.match(/^-(\d+)-\((.*?)\)$/)) {
                      // This might be the inner content capture group from split regex
                      // To distinguish, we check context or just assume standard split behavior.
                      // Let's refine split regex.
                      // split(/(-(?:\d+)-\(?:.*?\))/g) might be better to treat block as one separator?
                      // No, we want to replace the block.
                      return null;
                  }
                  
                  return <span key={idx}>{part}</span>;
              })}
          </div>
      );
  };

  const renderMultipleSelect = () => (
    <div className="space-y-3">
       <h3 className="text-lg font-medium mb-4 whitespace-pre-wrap">{task.content.question}</h3>
       {task.content.options.map((opt: string, idx: number) => (
           <label key={idx} className={`flex items-center p-4 rounded-lg border cursor-pointer hover:bg-gray-50 ${msSelected.includes(idx) ? 'bg-indigo-50 border-indigo-500' : 'border-gray-200'}`}>
               <input 
                 type="checkbox"
                 className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                 checked={msSelected.includes(idx)}
                 onChange={() => {
                     if (msSelected.includes(idx)) setMsSelected(msSelected.filter(i => i !== idx));
                     else setMsSelected([...msSelected, idx]);
                 }}
               />
               <span className="ml-3 text-gray-700">{opt}</span>
           </label>
       ))}
    </div>
  );

  const renderFillBlanks = () => {
    const text = task.content.text || "";
    // Split by blank markers -1-
    // Note: Use whitespace-pre-wrap on container
    const parts = text.split(/(-(\d+)-)/g); 
    
    return (
      <div className="leading-loose text-lg text-gray-800 whitespace-pre-wrap">
        {parts.map((part: string, idx: number) => {
          const match = part.match(/-(\d+)-/);
          if (match) {
            const id = match[1];
            return (
              <input
                key={idx}
                type="text"
                className="mx-1 border-b-2 border-indigo-300 focus:border-indigo-600 outline-none px-1 text-center w-32 bg-indigo-50/30 text-indigo-900"
                value={fbInputs[id] || ''}
                onChange={(e) => setFbInputs(prev => ({ ...prev, [id]: e.target.value }))}
                placeholder={`(${id})`}
              />
            );
          }
          if (part.match(/^\d+$/)) return null; 
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  const renderMatching = () => {
    const pairs = task.content.pairs as MatchingPair[];
    
    const handleLeftClick = (id: string) => {
      setMatchState(prev => ({ ...prev, leftSelected: id }));
    };

    const handleRightClick = (id: string) => {
      if (matchState.leftSelected) {
        setMatchState(prev => ({
          connections: { ...prev.connections, [prev.leftSelected!]: id },
          leftSelected: null
        }));
      }
    };

    return (
      <div className="flex justify-between gap-8 select-none">
        <div className="w-1/2 space-y-4">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('column_a')}</p>
          {pairs.map(p => (
            <div
              key={p.id}
              onClick={() => handleLeftClick(p.id)}
              className={`p-4 border rounded-lg cursor-pointer transition ${matchState.leftSelected === p.id ? 'bg-indigo-100 border-indigo-500' : matchState.connections[p.id] ? 'bg-green-50 border-green-200' : 'bg-white hover:border-indigo-300'}`}
            >
              {p.left}
            </div>
          ))}
        </div>
        <div className="w-1/2 space-y-4">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{t('column_b')}</p>
          {pairs.map(p => {
             const isConnected = Object.values(matchState.connections).includes(p.id);
             return (
              <div
                key={p.id}
                onClick={() => handleRightClick(p.id)}
                className={`p-4 border rounded-lg cursor-pointer transition ${isConnected ? 'bg-green-50 border-green-200' : 'bg-white hover:border-indigo-300'}`}
              >
                {p.right}
              </div>
             );
          })}
        </div>
      </div>
    );
  };

  const renderCategorize = () => {
      const categories = task.content.categories as Record<string, string>;
      const items = task.content.items as {id: string, text: string}[];

      return (
          <div className="space-y-6">
              {/* Unassigned Items (simplified visual) */}
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded min-h-[60px]">
                  {items.filter(i => !catState[i.id]).map(i => (
                      <div key={i.id} draggable className="bg-white border shadow-sm px-3 py-1 rounded cursor-pointer hover:bg-gray-100"
                           onClick={() => { /* Primitive interaction: cycling or select first then bucket */ }}
                      >
                          {i.text}
                          <span className="ml-2 text-xs text-gray-400">(Click bucket to assign)</span>
                      </div>
                  ))}
                  {items.filter(i => !catState[i.id]).length === 0 && <span className="text-gray-400 text-sm">All items assigned.</span>}
              </div>

              {/* Buckets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(categories).map(([id, name]) => (
                      <div key={id} className="border-2 border-dashed border-gray-300 rounded-xl p-4 min-h-[150px]">
                          <h4 className="font-bold text-center mb-2 text-indigo-600">{name}</h4>
                          <div className="space-y-2">
                             {/* Items in this bucket */}
                             {items.filter(i => catState[i.id] === id).map(i => (
                                 <div key={i.id} className="bg-indigo-50 px-3 py-2 rounded flex justify-between items-center">
                                     <span>{i.text}</span>
                                     <button onClick={() => setCatState(prev => { const n = {...prev}; delete n[i.id]; return n; })} className="text-red-400 hover:text-red-600">✕</button>
                                 </div>
                             ))}
                             
                             {/* Selector for unassigned items */}
                             <div className="mt-2">
                                <select 
                                   className="w-full text-xs p-1 border rounded"
                                   onChange={(e) => {
                                       if(e.target.value) setCatState(prev => ({...prev, [e.target.value]: id}));
                                       e.target.value = '';
                                   }}
                                >
                                    <option value="">+ Add item...</option>
                                    {items.filter(i => !catState[i.id]).map(i => (
                                        <option key={i.id} value={i.id}>{i.text}</option>
                                    ))}
                                </select>
                             </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const renderTrueFalse = () => (
      <div className="space-y-2">
          {task.content.statements.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded bg-white">
                  <span className="text-gray-800">{s.text}</span>
                  <div className="flex gap-2">
                      <button 
                         onClick={() => setTfAnswers(prev => ({...prev, [s.id]: true}))}
                         className={`px-4 py-1 rounded text-sm font-bold ${tfAnswers[s.id] === true ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                      >
                          {t('true')}
                      </button>
                      <button 
                         onClick={() => setTfAnswers(prev => ({...prev, [s.id]: false}))}
                         className={`px-4 py-1 rounded text-sm font-bold ${tfAnswers[s.id] === false ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                      >
                          {t('false')}
                      </button>
                  </div>
              </div>
          ))}
      </div>
  );

  const renderOrder = () => (
      <div className="space-y-2">
          {orderItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 p-3 bg-white border rounded shadow-sm">
                  <div className="flex flex-col">
                      <button 
                        disabled={idx === 0}
                        onClick={() => {
                            const newItems = [...orderItems];
                            [newItems[idx], newItems[idx-1]] = [newItems[idx-1], newItems[idx]];
                            setOrderItems(newItems);
                        }}
                        className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                      >▲</button>
                      <button 
                        disabled={idx === orderItems.length - 1}
                        onClick={() => {
                            const newItems = [...orderItems];
                            [newItems[idx], newItems[idx+1]] = [newItems[idx+1], newItems[idx]];
                            setOrderItems(newItems);
                        }}
                        className="text-gray-400 hover:text-indigo-600 disabled:opacity-30"
                      >▼</button>
                  </div>
                  <span className="flex-1">{item.text}</span>
                  <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
              </div>
          ))}
      </div>
  );

  const renderTable = () => (
    <TableRenderer 
      html={task.content.html} 
      onInputChange={(key, val) => setTableInputs(prev => ({...prev, [key]: val}))} 
    />
  );

  const renderPuzzle = () => {
      // 3x3 Grid
      const isImage = task.media?.type === 'image';
      
      const [first, setFirst] = useState<number | null>(null);

      const doSwap = (idx: number) => {
          if (first === null) {
              setFirst(idx);
          } else {
              const newTiles = [...puzzleTiles];
              [newTiles[first], newTiles[idx]] = [newTiles[idx], newTiles[first]];
              setPuzzleTiles(newTiles);
              setFirst(null);
          }
      }

      return (
          <div>
              <p className="mb-4 text-center text-sm text-gray-500">{t('puzzle_instruction')}</p>
              <div className="grid grid-cols-3 gap-1 w-[300px] h-[300px] mx-auto bg-gray-200 border-2 border-gray-800">
                  {puzzleTiles.map((tileIndex, positionIndex) => {
                      const x = (tileIndex % 3) * 100;
                      const y = Math.floor(tileIndex / 3) * 100;
                      
                      return (
                          <div 
                             key={positionIndex}
                             onClick={() => doSwap(positionIndex)}
                             className={`relative cursor-pointer hover:opacity-90 transition ${first === positionIndex ? 'ring-4 ring-yellow-400 z-10' : ''}`}
                             style={{
                                 width: '100%', height: '100%',
                                 backgroundColor: '#ddd',
                                 backgroundImage: isImage ? `url(${task.media?.url})` : 'none',
                                 backgroundPosition: `-${x}% -${y}%`,
                                 backgroundSize: '300% 300%',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center'
                             }}
                          >
                              {!isImage && <span className="text-xl font-bold text-gray-700">{task.content.text?.charAt(tileIndex) || tileIndex + 1}</span>}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderFreeText = () => (
    <div>
      <h3 className="text-lg font-medium mb-4 whitespace-pre-wrap">{task.content.prompt}</h3>
      <textarea
        className="w-full h-64 p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
        placeholder={t('type_answer')}
        value={ftText}
        onChange={(e) => setFtText(e.target.value)}
      />
    </div>
  );

  const renderUseFromList = () => {
      const text = task.content.text || "";
      // Split by blank markers -1-
      // Note: Use whitespace-pre-wrap on container
      const parts = text.split(/(-(\d+)-)/g); 
      
      return (
        <div>
           {/* Word Bank */}
           <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
               <h3 className="text-sm font-bold text-yellow-800 uppercase mb-2 tracking-wide">{t('word_bank')}</h3>
               <div className="flex flex-wrap gap-2">
                   {uflBank.map((word, idx) => (
                       <span key={idx} className="bg-white border border-yellow-300 text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                           {word}
                       </span>
                   ))}
               </div>
           </div>

           {/* Content */}
           <div className="leading-loose text-lg text-gray-800 whitespace-pre-wrap">
              {parts.map((part: string, idx: number) => {
                  const match = part.match(/-(\d+)-/);
                  if (match) {
                      const id = match[1];
                      return (
                          <input
                              key={idx}
                              type="text"
                              className="mx-1 border-b-2 border-indigo-300 focus:border-indigo-600 outline-none px-1 text-center w-32 bg-indigo-50/30 text-indigo-900"
                              value={uflInputs[id] || ''}
                              onChange={(e) => setUflInputs(prev => ({ ...prev, [id]: e.target.value }))}
                          />
                      );
                  }
                  if (part.match(/^\d+$/)) return null; 
                  return <span key={idx}>{part}</span>;
              })}
           </div>
        </div>
      );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto my-8">
      <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold">{task.title}</h2>
           <p className="opacity-80 whitespace-pre-wrap">{task.description}</p>
        </div>
        <button onClick={onCancel} className="text-white/70 hover:text-white">{t('close')}</button>
      </div>
      
      <div className="p-8">
        {renderMedia()}
        
        {task.type === TaskType.MULTIPLE_CHOICE && renderMC()}
        {task.type === TaskType.MULTIPLE_SELECT && renderMultipleSelect()}
        {task.type === TaskType.FILL_IN_BLANKS && renderFillBlanks()}
        {task.type === TaskType.MATCHING && renderMatching()}
        {task.type === TaskType.CATEGORIZE && renderCategorize()}
        {task.type === TaskType.TRUE_FALSE && renderTrueFalse()}
        {task.type === TaskType.ORDER && renderOrder()}
        {task.type === TaskType.TABLE && renderTable()}
        {task.type === TaskType.PUZZLE && renderPuzzle()}
        {task.type === TaskType.FREE_TEXT && renderFreeText()}
        {task.type === TaskType.USE_FROM_LIST && renderUseFromList()}
      </div>

      <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
        <button 
          onClick={onCancel}
          className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition"
        >
          {t('cancel')}
        </button>
        <button 
          onClick={handleSubmit}
          className="px-8 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow-lg hover:bg-indigo-700 hover:shadow-xl transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
        >
          {t('submit_answer')}
        </button>
      </div>
    </div>
  );
};

export default TaskTaker;