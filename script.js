        // --- PocketBase API Configuration ---
        const PB_URL = 'http://107.172.32.153:8090';
        const API_BASE_URL = PB_URL + '/api';

        let currentUser = null;
        let authToken = null;

        // API Client for PocketBase
        const API = {
            async request(endpoint, options = {}) {
                const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
                const headers = { ...options.headers };

                if (authToken) {
                    headers['Authorization'] = authToken;
                }

                if (options.body && !(options.body instanceof FormData)) {
                    headers['Content-Type'] = 'application/json';
                }

                try {
                    const response = await fetch(url, { ...options, headers });

                    if (response.status === 204) return {};

                    const data = await response.json();

                    if (!response.ok) {
                        const msg = (data.data ? Object.values(data.data)[0]?.message : null) || data.message || 'Request failed';
                        throw new Error(msg);
                    }

                    return data;
                } catch (error) {
                    if (error instanceof TypeError) throw error;
                    console.error('API Error:', error);
                    throw error;
                }
            },

            auth: {
                async register(email, password) {
                    return await API.request('/collections/users/records', {
                        method: 'POST',
                        body: JSON.stringify({ email, password, passwordConfirm: password })
                    });
                },

                async login(email, password) {
                    return await API.request('/collections/users/auth-with-password', {
                        method: 'POST',
                        body: JSON.stringify({ identity: email, password })
                    });
                },

                async getMe() {
                    if (!currentUser || !currentUser.id) throw new Error('Not logged in');
                    return await API.request('/collections/users/records/' + currentUser.id);
                },

                async forgotPassword(email) {
                    return await API.request('/collections/users/request-password-reset', {
                        method: 'POST',
                        body: JSON.stringify({ email })
                    });
                },

                async resetPassword(token, password) {
                    return await API.request('/collections/users/confirm-password-reset', {
                        method: 'POST',
                        body: JSON.stringify({ token, password, passwordConfirm: password })
                    });
                }
            },

            wordlists: {
                async list() {
                    const result = await API.request('/collections/wordlists/records?perPage=500');
                    return { files: (result.items || []).map(function(item) { return { name: item.name, filename: item.filename }; }) };
                },
                async getContent(filename) {
                    const result = await API.request('/collections/wordlists/records?perPage=500');
                    const items = result.items || [];
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].filename === filename || items[i].name === filename) {
                            if (items[i].content) return items[i].content;
                        }
                    }
                    throw new Error('File not found');
                },
                async upload(formData) {
                    const file = formData.get('file');
                    const text = await file.text();
                    return await API.request('/collections/wordlists/records', {
                        method: 'POST',
                        body: JSON.stringify({ name: file.name, filename: file.name, content: text })
                    });
                },
                async deleteFile(filename) {
                    const result = await API.request('/collections/wordlists/records?perPage=500');
                    const items = result.items || [];
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].filename === filename || items[i].name === filename) {
                            return await API.request('/collections/wordlists/records/' + items[i].id, { method: 'DELETE' });
                        }
                    }
                    throw new Error('File not found');
                }
            },

            progress: {
                async get() {
                    try {
                        const result = await API.request('/collections/progress/records?filter=(user="' + currentUser.id + '")&perPage=1');
                        const progress = (result.items && result.items.length > 0) ? {
                            last_file: result.items[0].last_file,
                            last_content: result.items[0].last_content,
                            last_page: result.items[0].last_page
                        } : null;
                        return { progress: progress };
                    } catch(e) { return { progress: null }; }
                },
                async update(data) {
                    try {
                        const result = await API.request('/collections/progress/records?filter=(user="' + currentUser.id + '")&perPage=1');
                        if (result.items && result.items.length > 0) {
                            return await API.request('/collections/progress/records/' + result.items[0].id, {
                                method: 'PATCH',
                                body: JSON.stringify(data)
                            });
                        } else {
                            return await API.request('/collections/progress/records', {
                                method: 'POST',
                                body: JSON.stringify({ user: currentUser.id, last_file: data.last_file || '', last_page: data.last_page || 1 })
                            });
                        }
                    } catch(e) { console.error('Progress update failed:', e); }
                }
            },

            stats: {
                async getAll() {
                    try {
                        const result = await API.request('/collections/word_stats/records?filter=(user="' + currentUser.id + '")&perPage=10000');
                        return { stats: (result.items || []).map(function(item) {
                            return { word: item.word, correct: item.correct || 0, wrong: item.wrong || 0, last_practiced: item.last_practiced || '' };
                        })};
                    } catch(e) { return { stats: [] }; }
                },
                async update(word, correct, wrong, last_practiced) {
                    try {
                        const filter = '(user="' + currentUser.id + '"&&word="' + encodeURIComponent(word) + '")';
                        const result = await API.request('/collections/word_stats/records?filter=' + filter + '&perPage=1');
                        const body = { word: word, correct: correct, wrong: wrong, last_practiced: String(last_practiced) };
                        if (result.items && result.items.length > 0) {
                            return await API.request('/collections/word_stats/records/' + result.items[0].id, {
                                method: 'PATCH', body: JSON.stringify(body)
                            });
                        } else {
                            return await API.request('/collections/word_stats/records', {
                                method: 'POST', body: JSON.stringify({ user: currentUser.id, word: word, correct: correct, wrong: wrong, last_practiced: String(last_practiced) })
                            });
                        }
                    } catch(e) { console.error('Stats update failed:', e); }
                },
                async daily() {
                    try {
                        const today = new Date().toISOString().slice(0, 10);
                        const result = await API.request('/collections/daily_stats/records?filter=(user="' + currentUser.id + '"&&date="' + today + '")&perPage=1');
                        return { daily: (result.items || []).map(function(d) {
                            return { date: d.date, words_practiced: d.words_practiced || 0, correct_count: d.correct_count || 0, wrong_count: d.wrong_count || 0 };
                        })};
                    } catch(e) { return { daily: [] }; }
                },
                async saveDaily(correct, wrong) {
                    try {
                        const today = new Date().toISOString().slice(0, 10);
                        const result = await API.request('/collections/daily_stats/records?filter=(user="' + currentUser.id + '"&&date="' + today + '")&perPage=1');
                        if (result.items && result.items.length > 0) {
                            const d = result.items[0];
                            return await API.request('/collections/daily_stats/records/' + d.id, {
                                method: 'PATCH',
                                body: JSON.stringify({ words_practiced: (d.words_practiced || 0) + correct + wrong, correct_count: (d.correct_count || 0) + correct, wrong_count: (d.wrong_count || 0) + wrong })
                            });
                        } else {
                            return await API.request('/collections/daily_stats/records', {
                                method: 'POST',
                                body: JSON.stringify({ user: currentUser.id, date: today, words_practiced: correct + wrong, correct_count: correct, wrong_count: wrong })
                            });
                        }
                    } catch(e) { console.error('Daily stats failed:', e); }
                }
            }
        };

        let allWordData = [];
        let displayData = [];
        let currentPage = 1;
        let startTime;
        let spellTimeout;
        let currentMode = 'all';
        let reviewWordList = [];
        const WORDS_PER_PAGE = 10;
        const youdaoAPI = 'https://dict.youdao.com/dictvoice?audio=';

        // --- Auth Functions ---
        let isLoginMode = true;

        function openAuthModal() {
            document.getElementById('authModal').style.display = 'flex';
            resetAuthUI();
        }

        function closeAuthModal() {
            document.getElementById('authModal').style.display = 'none';
            resetAuthUI();
        }

        function openHelpModal() {
            document.getElementById('helpModal').style.display = 'flex';
        }

        function closeHelpModal() {
            document.getElementById('helpModal').style.display = 'none';
        }

        function toggleAuthMode() {
            isLoginMode = !isLoginMode;
            resetAuthUI();
        }

        let isForgotMode = false;

        function showForgotPassword() {
            isForgotMode = true;
            document.getElementById('authTitle').innerText = '找回密码';
            document.getElementById('authPassword').style.display = 'none';
            document.getElementById('authActionBtn').innerText = '发送重置邮件';
            document.getElementById('authActionBtn').onclick = handleForgotPassword;
            document.getElementById('authSwitchText').innerText = '想起密码了？点击登录';
            document.getElementById('forgotPwdLink').style.display = 'none';
            document.getElementById('authError').style.display = 'none';
        }

        async function handleForgotPassword() {
            const email = document.getElementById('authEmail').value;
            const errorEl = document.getElementById('authError');
            const btn = document.getElementById('authActionBtn');

            if (!email) {
                errorEl.innerText = '请输入您的注册邮箱';
                errorEl.style.display = 'block';
                return;
            }

            btn.innerText = '发送中...';
            btn.disabled = true;

            try {
                await API.auth.forgotPassword(email);
                errorEl.style.color = '#28a745';
                errorEl.innerText = '重置邮件已发送，请查收邮箱（可能在垃圾邮件），点击邮件中的链接重置密码。';
                errorEl.style.display = 'block';
            } catch (err) {
                errorEl.style.color = '#dc3545';
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            } finally {
                btn.innerText = '发送重置邮件';
                btn.disabled = false;
            }
        }

        function resetAuthUI() {
            isForgotMode = false;
            document.getElementById('authTitle').innerText = isLoginMode ? '登录云端' : '注册新账号';
            document.getElementById('authActionBtn').innerText = isLoginMode ? '立即登录' : '立即注册';
            document.getElementById('authActionBtn').onclick = handleAuthAction;
            document.getElementById('authSwitchText').innerText = isLoginMode ? '没有账号？点击注册' : '已有账号？点击登录';
            document.getElementById('authError').style.display = 'none';
            document.getElementById('authError').style.color = '#dc3545';
            document.getElementById('forgotPwdLink').style.display = '';
            document.getElementById('authPassword').style.display = 'block';
            document.getElementById('authPassword').placeholder = '密码 (Password - min 8 chars)';
            var codeInput = document.getElementById('resetCodeInput');
            if (codeInput) codeInput.remove();
            var tokenInput = document.getElementById('resetTokenInput');
            if (tokenInput) tokenInput.remove();
        }

        async function handleAuthAction() {
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const errorEl = document.getElementById('authError');
            const btn = document.getElementById('authActionBtn');

            errorEl.style.display = 'none';

            if (!email || !password || password.length < 8) {
                errorEl.innerText = '请输入有效的邮箱和密码（密码至少8位）';
                errorEl.style.display = 'block';
                return;
            }

            const originalText = btn.innerText;
            btn.innerText = '处理中...';
            btn.disabled = true;

            try {
                let result;
                if (isLoginMode) {
                    result = await API.auth.login(email, password);
                    authToken = result.token;
                    currentUser = result.record;
                } else {
                    result = await API.auth.register(email, password);
                    // After registration, auto-login
                    const loginResult = await API.auth.login(email, password);
                    authToken = loginResult.token;
                    currentUser = loginResult.record;
                }

                localStorage.setItem('authToken', authToken);
                localStorage.setItem('userInfo', JSON.stringify(currentUser));
                localStorage.setItem('userId', currentUser.id);

                closeAuthModal();
                updateUserSession(currentUser);

                if (!isLoginMode) {
                    showToast('注册成功！', 'success');
                }

            } catch (err) {
                errorEl.innerText = err.message;
                errorEl.style.display = 'block';
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

        async function signOut() {
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            localStorage.removeItem('userId');
            window.location.reload();
        }

        // Auth Init
        document.addEventListener('DOMContentLoaded', async function() {
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);

            authToken = localStorage.getItem('authToken');

            if (authToken) {
                const cachedUser = localStorage.getItem('userInfo');
                if (cachedUser) {
                    try {
                        currentUser = JSON.parse(cachedUser);
                        updateUserSession(currentUser);
                    } catch(e) {}
                }

                try {
                    const userData = await API.auth.getMe();
                    currentUser = userData;
                    localStorage.setItem('userInfo', JSON.stringify(userData));
                    updateUserSession(currentUser);
                } catch (error) {
                    console.warn('Token invalid:', error);
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userInfo');
                    localStorage.removeItem('userId');
                    authToken = null;
                    updateUserSession(null);
                }
            } else {
                updateUserSession(null);
            }
        });

        function updateUserSession(user) {
            currentUser = user;
            const userSection = document.getElementById('userSection');
            const loginBtn = document.getElementById('loginBtn');
            const adminPanelBtn = document.getElementById('adminPanelBtn');
            const fileInput = document.getElementById('fileInput');
            const fileSelectBtn = document.getElementById('fileSelectBtn');
            const fileStatus = document.getElementById('fileStatus');
            const libraryToggleBtn = document.getElementById('libraryToggleBtn');

            if (currentUser) {
                document.getElementById('userEmail').innerText = currentUser.email;
                    document.getElementById('userEmail').style.color = '';
                userSection.style.display = 'flex';
                loginBtn.style.display = 'none';

                if (adminPanelBtn) adminPanelBtn.style.display = 'inline-block';

                if (fileInput) fileInput.disabled = false;
                if (fileSelectBtn) fileSelectBtn.disabled = false;
                if (fileStatus) fileStatus.innerText = '请选择CSV词库文件,或使用示例数据';

                if (libraryToggleBtn) {
                    libraryToggleBtn.disabled = false;
                    libraryToggleBtn.title = '打开词库列表';
                }

                CloudPersistence.load();
            } else {
                userSection.style.display = 'none';
                loginBtn.style.display = 'block';
                if (adminPanelBtn) adminPanelBtn.style.display = 'none';

                if (fileInput) fileInput.disabled = true;
                if (fileSelectBtn) fileSelectBtn.disabled = true;
                if (fileStatus) fileStatus.innerText = '请先登录后才能导入词库';

                if (libraryToggleBtn) {
                    libraryToggleBtn.disabled = true;
                    libraryToggleBtn.title = '登录后查看词库列表';
                }
                autoLoadCSV();
            }
        }

        // --- Admin Panel Functions ---
        function openAdminPanel() {
            loadPendingUsers();
            document.getElementById('adminModal').style.display = 'flex';
            loadSharedForAdmin();
        }

        async function loadSharedForAdmin() {
            var container = document.getElementById('sharedWordlistList');
            if (!container) return;
            try {
                var resp = await API.wordlists.list();
                var files = resp.files || [];
                if (files.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#666;">暂无共享词库</p>';
                } else {
                    container.innerHTML = files.map(function(f) {
                        var safeName = f.name.replace(/'/g, "\\'");
                        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:5px;"><span>' + f.name + '</span><button class="btn btn-secondary" style="background:#dc3545; color:#fff; padding:4px 10px; font-size:12px; min-height:auto;" onclick="deleteSharedWordlist(\'' + safeName + '\')">删除</button></div>';
                    }).join('');
                }
            } catch(e) {
                container.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败</p>';
            }
        }

        function uploadSharedWordlist() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.txt';
            input.onchange = async function() {
                if (!input.files[0]) return;
                var formData = new FormData();
                formData.append('file', input.files[0]);
                try {
                    var result = await API.wordlists.upload(formData);
                    showToast('上传成功', 'success');
                    loadSharedForAdmin();
                    loadSharedWordlists();
                } catch(e) {
                    showToast('上传失败: ' + e.message, 'error');
                }
            };
            input.click();
        }

        async function deleteSharedWordlist(filename) {
            if (!(await showConfirm('确定删除 ' + filename + '？', '删除', '取消', true))) return;
            try {
                await API.wordlists.deleteFile(filename);
                showToast('已删除', 'success');
                loadSharedForAdmin();
                loadSharedWordlists();
            } catch(e) {
                showToast('删除失败: ' + e.message, 'error');
            }
        }

        function closeAdminPanel() {
            document.getElementById('adminModal').style.display = 'none';
        }

// === Admin User Approval ===
async function loadPendingUsers() {
    var container = document.getElementById("pendingUsersList");
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:#666;">加载中...</p>';
    try {
        var result = await API.request('/collections/users/records?perPage=500&sort=-created');
        var users = result.items || [];
        var html = '<strong style="font-size:13px;">所有用户 (' + users.length + '人)</strong>';
        users.forEach(function(u) {
            html += '<div style="border:1px solid var(--border-color); padding:10px; margin:8px 0; border-radius:6px; background:var(--card-bg);">';
            html += '<div style="margin-bottom:8px;"><strong>' + u.email + '</strong><br><span style="font-size:11px; color:#999;">' + new Date(u.created).toLocaleString('zh-CN') + '</span></div>';
            html += '<button class="btn btn-secondary" onclick="rejectUser(\'' + u.id + '\')" style="background:#dc3545; color:#fff; font-size:11px; padding:4px 12px;">删除</button>';
            html += '</div>';
        });
        container.innerHTML = html;
    } catch(e) {
        container.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败: ' + e.message + '</p>';
    }
}

async function rejectUser(userId) {
    if (!(await showConfirm('确定删除该用户？此操作不可恢复。', '删除', '取消', true))) return;
    try {
        await API.request('/collections/users/records/' + userId, { method: 'DELETE' });
        showToast('已删除！', 'success');
        loadPendingUsers();
    } catch(e) { showToast('操作失败: ' + e.message, 'error'); }
}

        loadPendingUsers();

        // --- Toast & Confirm Utilities ---
        function showToast(msg, type) {
            type = type || 'info';
            var container = document.getElementById('toastContainer');
            var toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            toast.textContent = msg;
            toast.onclick = function() { toast.remove(); };
            container.appendChild(toast);
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2800);
        }

        function showConfirm(msg, okText, cancelText, isDanger) {
            return new Promise(function(resolve) {
                var overlay = document.getElementById('confirmOverlay');
                document.getElementById('confirmMsg').textContent = msg;
                var okBtn = document.getElementById('confirmOkBtn');
                okBtn.textContent = okText || '确定';
                okBtn.style.background = isDanger ? '#dc3545' : '#28a745';
                document.getElementById('confirmCancelBtn').textContent = cancelText || '取消';
                overlay.classList.add('show');

                function cleanup() {
                    overlay.classList.remove('show');
                    okBtn.removeEventListener('click', onOk);
                    document.getElementById('confirmCancelBtn').removeEventListener('click', onCancel);
                }
                function onOk() { cleanup(); resolve(true); }
                function onCancel() { cleanup(); resolve(false); }

                okBtn.addEventListener('click', onOk);
                document.getElementById('confirmCancelBtn').addEventListener('click', onCancel);
            });
        }

        // --- Audio ---
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        function playCorrectSound() {
            // Cheerful "pop" arpeggio: notes bounce up C5 -> E5 -> G5 -> C6
            try {
                if (audioContext.state === 'suspended') audioContext.resume();
                const t = audioContext.currentTime;
                const notes = [523.25, 659.25, 783.99, 1046.5];
                notes.forEach((freq, i) => {
                    const osc = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    osc.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    osc.type = 'triangle';
                    const start = t + i * 0.07;
                    osc.frequency.setValueAtTime(freq * 0.75, start);
                    osc.frequency.exponentialRampToValueAtTime(freq, start + 0.06);
                    gainNode.gain.setValueAtTime(0.0001, start);
                    gainNode.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, start + 0.24);
                    osc.start(start);
                    osc.stop(start + 0.26);
                });
            } catch (e) { console.log('Sound error:', e); }
        }

        // --- Cloud Persistence ---
        const CloudPersistence = {
            async saveProgress(filename, content, page) {
                if (!currentUser || !authToken) return;
                try {
                    await API.progress.update({ last_file: filename, last_content: content, last_page: page });
                } catch (error) {
                    console.error('Cloud save failed:', error);
                }
            },
            async load() {
                if (!currentUser || !authToken) return;
                try {
                    const result = await API.progress.get();
                    if (result.progress && result.progress.last_file) {
                        localStorage.setItem('last_csv_filename', result.progress.last_file);
                        if (result.progress.last_content) localStorage.setItem('last_csv_content', result.progress.last_content);
                        localStorage.setItem('last_page', result.progress.last_page || 1);
                        autoLoadCSV();
                    } else {
                        autoLoadCSV();
                    }
                } catch (error) {
                    console.error('Cloud load failed:', error);
                    autoLoadCSV();
                }
            }
        };

        const DataPersistence = {
            save(filename, content) {
                try {
                    localStorage.setItem('last_csv_filename', filename);
                    localStorage.setItem('last_csv_content', content);
                    if (currentUser) CloudPersistence.saveProgress(filename, content, currentPage);
                } catch (e) { console.error('Storage full?', e); }
            },
            load() {
                const filename = localStorage.getItem('last_csv_filename');
                const content = localStorage.getItem('last_csv_content');
                if (filename && content) return { filename: filename, content: content };
                return null;
            },
            savePage(page) {
                localStorage.setItem('last_page', page);
                if (currentUser) {
                    const data = this.load();
                    if (data) CloudPersistence.saveProgress(data.filename, data.content, page);
                }
            },
            loadPage() {
                return parseInt(localStorage.getItem('last_page') || 1);
            }
        };

        // --- Stats Manager ---
        const WordStats = {
            storageKey: 'word_spelling_stats',
            data: {},

            async init() {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) this.data = JSON.parse(stored);

                if (currentUser && authToken) {
                    try {
                        const result = await API.stats.getAll();
                        if (result.stats) {
                            result.stats.forEach(function(row) {
                                if (row.word) {
                                    this.data[row.word] = { correct: row.correct, wrong: row.wrong, lastPracticed: row.last_practiced };
                                }
                            }.bind(this));
                            this.saveFunc();
                        }
                    } catch (error) { console.error('Failed to load stats:', error); }
                }
            },

            saveFunc() {
                localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            },

            async save(word, stat) {
                this.saveFunc();
                if (currentUser && authToken && word) {
                    try {
                        await API.stats.update(word, stat.correct, stat.wrong, stat.lastPracticed);
                    } catch (error) { console.error('Failed to save stat:', error); }
                }
            },

            get(word) {
                return this.data[word] || { correct: 0, wrong: 0, lastPracticed: 0 };
            },

            update(word, isCorrect) {
                if (!this.data[word]) this.data[word] = { correct: 0, wrong: 0, lastPracticed: 0 };
                const stat = this.data[word];
                if (isCorrect) stat.correct++;
                else stat.wrong++;
                stat.lastPracticed = Date.now();
                this.save(word, stat);
                if (typeof WordSRS !== 'undefined') WordSRS.record(word, isCorrect);
                if (typeof DailyLog !== 'undefined') DailyLog.record(word, isCorrect);
            }
        };

        // --- Spaced Repetition (今日复习) ---
        const WordSRS = {
            storageKey: 'word_spelling_srs',
            data: {},
            intervals: [1, 2, 4, 7, 15, 30],

            init() {
                try {
                    this.data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                } catch (e) {
                    this.data = {};
                }
            },

            save() {
                localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            },

            startOfDay(ts) {
                const d = new Date(ts);
                d.setHours(0, 0, 0, 0);
                return d.getTime();
            },

            get(word) {
                if (this.data[word]) return this.data[word];
                // Words practiced before SRS existed: derive a schedule from their stats
                const st = WordStats.get(word);
                if (st.correct === 0 && st.wrong === 0) return null;
                let level = 0;
                if (st.wrong === 0 && st.correct >= 3) level = 3;
                else if (st.correct >= 2) level = 2;
                else if (st.correct >= 1) level = 1;
                const rec = {
                    level: level,
                    due: this.startOfDay(st.lastPracticed || Date.now()) + this.intervals[level] * 86400000
                };
                this.data[word] = rec;
                this.save();
                return rec;
            },

            record(word, isCorrect) {
                let rec = this.data[word] || { level: 0, due: 0 };
                if (isCorrect) {
                    rec.due = this.startOfDay(Date.now()) + this.intervals[Math.min(rec.level, this.intervals.length - 1)] * 86400000;
                    rec.level = Math.min(rec.level + 1, this.intervals.length - 1);
                } else {
                    rec.level = 0;
                    rec.due = this.startOfDay(Date.now()) + 86400000;
                }
                this.data[word] = rec;
                this.save();
            },

            dueWords() {
                const endToday = this.startOfDay(Date.now()) + 86400000;
                return allWordData
                    .filter(w => {
                        const r = this.get(w.english);
                        return r && r.due < endToday;
                    })
                    .sort((a, b) => this.get(a.english).due - this.get(b.english).due);
            }
        };
        WordSRS.init();

        function updateReviewBadge() {
            const badge = document.getElementById('reviewBadge');
            if (!badge || typeof allWordData === 'undefined' || !allWordData.length) return;
            const count = WordSRS.dueWords().length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }

        function togglePeek(btn) {
            const item = btn.closest('.word-item');
            const box = item ? item.querySelector('.dictation-chinese') : null;
            if (box) {
                box.style.display = 'block';
                btn.style.display = 'none';
            }
        }

        WordStats.init();

        // --- Reset all mastered words ---
        async function resetAllMastered() {
            const masteredCount = allWordData.filter(function(w) {
                const stats = WordStats.get(w.english);
                return stats.correct >= 3 && stats.wrong === 0;
            }).length;

            if (masteredCount === 0) {
                showToast('没有已背熟的单词哦！', 'info');
                return;
            }

            if (await showConfirm('确定要重置所有已背熟的单词吗？\n\n将清空 ' + masteredCount + ' 个单词的学习记录！', '确认重置', '取消', true)) {
                allWordData.forEach(function(w) {
                    const stats = WordStats.get(w.english);
                    if (stats.correct >= 3 && stats.wrong === 0) {
                        WordStats.data[w.english] = { correct: 0, wrong: 0, lastPracticed: 0 };
                        WordStats.save(w.english, WordStats.data[w.english]);
                        if (typeof WordSRS !== 'undefined') { delete WordSRS.data[w.english]; WordSRS.save(); }
                    }
                });
                filterData();
                renderPage(1);
                renderPagination();
                showToast('已重置 ' + masteredCount + ' 个单词！', 'success');
            }
        }

        // --- Mode switching ---
        async function switchMode(mode) {
            currentMode = mode;
            document.querySelectorAll('.mode-btn').forEach(function(btn) { btn.classList.remove('active'); });
            if (event.target) event.target.classList.add('active');

            if (mode === 'review') {
                reviewWordList = WordSRS.dueWords().map(function(w) { return w.english; });
            }

            filterData();
            currentPage = 1;
            renderPage(1);
            renderPagination();
        }

        function filterData() {
            const isMastered = function(word) {
                const stats = WordStats.get(word.english);
                return stats.correct >= 3 && stats.wrong === 0;
            };

            if (currentMode === 'all') {
                displayData = allWordData.slice();
            } else if (currentMode === 'new') {
                displayData = allWordData.filter(function(w) {
                    if (isMastered(w)) return false;
                    const stats = WordStats.get(w.english);
                    return stats.correct === 0 && stats.wrong === 0;
                });
            } else if (currentMode === 'mistake') {
                displayData = allWordData.filter(function(w) {
                    if (isMastered(w)) return false;
                    const stats = WordStats.get(w.english);
                    return stats.wrong > 0 && stats.wrong > stats.correct;
                }).sort(function(a, b) {
                    return WordStats.get(b.english).wrong - WordStats.get(a.english).wrong;
                });
            } else if (currentMode === 'mastered') {
                displayData = allWordData.filter(function(w) { return isMastered(w); });
            } else if (currentMode === 'review') {
                displayData = allWordData.filter(function(w) {
                    return reviewWordList.indexOf(w.english) >= 0;
                });
            } else if (currentMode === 'dictation') {
                displayData = allWordData.slice();
            }
        }

        // --- Timer ---
        function updateTime() {
            const now = new Date();
            document.getElementById('currentTime').textContent = '当前时间: ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        }
        setInterval(updateTime, 60000);
        updateTime();

        // --- File input ---
        document.querySelector('.file-input-wrapper button').addEventListener('click', function() {
            document.getElementById('fileInput').click();
        });

        document.getElementById('timerBtn').addEventListener('click', function() {
            if (!startTime) {
                startTime = Date.now();
                document.getElementById('timerBtn').textContent = '停止计时';
                setInterval(function() {
                    if (startTime) {
                        let elapsed = Math.floor((Date.now() - startTime) / 1000);
                        document.getElementById('elapsedTimeDisplay').textContent = '已用时间: ' + elapsed + ' 秒';
                    }
                }, 1000);
            } else {
                startTime = null;
                document.getElementById('timerBtn').textContent = '开始计时';
            }
        });

        document.getElementById('screenshotBtn').addEventListener('click', function() {
            html2canvas(document.body, { scale: window.devicePixelRatio || 1, useCORS: true }).then(function(canvas) {
                const link = document.createElement('a');
                link.download = '拼写检测截图_' + new Date().toISOString().slice(0, 19) + '.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        });

        document.getElementById('fileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) { parseCSVData(e.target.result, file.name); };
                reader.readAsText(file);
            }
        });

        // --- Rendering ---
        function renderPage(page) {
        renderTextbookBar(); renderSchoolBar(); resetReverse();
            currentPage = page;
            DataPersistence.savePage(page);
            updateReviewBadge();
            const start = (page - 1) * WORDS_PER_PAGE;

            if (displayData.length === 0) {
                var emptyMsg = currentMode === 'review' ? '今天没有要复习的单词，去学几个新词吧' : '当前模式下没有单词哦';
                document.getElementById('wordList').innerHTML = '<div style="text-align:center; padding: 20px; color: #666;">' + emptyMsg + '</div>';
                return;
            }

            const words = displayData.slice(start, start + WORDS_PER_PAGE);
            const isDictation = currentMode === 'dictation';
            document.getElementById('wordList').innerHTML = words.map(function(word, index) {
                const stats = WordStats.get(word.english);
                const esc = word.english.replace(/'/g, "\\'");
                const statsHtml = '<div class="word-stats">' +
                        '<span class="stat-badge correct">' + stats.correct + '</span>' +
                        '<span class="stat-badge wrong">' + stats.wrong + '</span>' +
                        (stats.correct >= 3 && stats.wrong === 0 ? '<span class="stat-badge" style="background:#d4edda; color:#155724;">已背熟</span>' : '') +
                    '</div>';
                const inputHtml = '<div class="input-container">' +
                        '<input type="text" class="input-box" placeholder="请输入英文单词..." oninput="checkSpelling(this, \'' + esc + '\', this.nextElementSibling)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
                        '<span class="check-icon"></span>' +
                    '</div>' +
                    '<div class="action-buttons">' +
                        '<button class="btn-icon btn-sound" onclick="playSound(\'' + esc + '\')" title="播放发音">发音</button>' +
                        '<button class="btn-icon btn-spell" onclick="showSpelling(\'' + esc + '\')" title="拼写示范">拼写</button>' +
                        '<button class="btn-icon btn-hint" onclick="showHint(this, \'' + esc + '\')" title="提示">提示</button>' +
                        '<button class="btn-icon btn-ex" onclick="toggleExample(this, \'' + esc + '\')" title="例句">例句</button>' +
                        '<div class="hint-line"></div>' +
                        '<div class="ex-line"></div>' +
                    '</div>';
                if (isDictation) {
                    return '<div class="word-item">' +
                        '<div class="dictation-row">' +
                            '<button class="btn-listen" onclick="playSound(\'' + esc + '\')" title="再听一遍">🔊</button>' +
                            '<div class="dictation-side">' +
                                '<div class="dictation-tip">听发音，拼出这个单词</div>' +
                                '<div class="dictation-chinese chinese-text" style="display:none;">' + word.chinese + '</div>' +
                                '<button class="peek-btn" onclick="togglePeek(this)">偷看中文 👀</button>' +
                            '</div>' +
                        '</div>' +
                        statsHtml +
                        inputHtml +
                    '</div>';
                }
                return '<div class="word-item">' +
                    '<div class="chinese-text">' + word.chinese + '</div>' +
                    statsHtml +
                    inputHtml +
                '</div>';
            }).join('');
            if (isDictation && words.length > 0) {
                setTimeout(function() { playSound(words[0].english); }, 350);
            }
        }

        function renderPagination() {
            const totalPages = Math.ceil(displayData.length / WORDS_PER_PAGE);
            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';

            if (totalPages <= 1) return;

            if (currentPage > 1) {
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '上一页';
                prevButton.addEventListener('click', function() { renderPage(currentPage - 1); renderPagination(); });
                pagination.appendChild(prevButton);
            }

            const start = Math.max(1, currentPage - 2);
            const end = Math.min(totalPages, currentPage + 2);

            if (start > 1) {
                const firstButton = document.createElement('button');
                firstButton.textContent = '1';
                firstButton.addEventListener('click', function() { renderPage(1); renderPagination(); });
                pagination.appendChild(firstButton);
                if (start > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 10px';
                    pagination.appendChild(ellipsis);
                }
            }

            for (let i = start; i <= end; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                button.classList.toggle('active', i === currentPage);
                button.addEventListener('click', function() { renderPage(i); renderPagination(); });
                pagination.appendChild(button);
            }

            if (end < totalPages) {
                if (end < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 10px';
                    pagination.appendChild(ellipsis);
                }
                const lastButton = document.createElement('button');
                lastButton.textContent = totalPages;
                lastButton.addEventListener('click', function() { renderPage(totalPages); renderPagination(); });
                pagination.appendChild(lastButton);
            }

            if (currentPage < totalPages) {
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '下一页';
                nextButton.addEventListener('click', function() { renderPage(currentPage + 1); renderPagination(); });
                pagination.appendChild(nextButton);
            }
        }

        // Mobile scroll on focus
        document.addEventListener('focus', function(e) {
            if (e.target.tagName === 'INPUT') {
                setTimeout(function() { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
            }
        }, true);

        // --- Levenshtein distance ---
        function levenshtein(a, b) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            var matrix = [];
            for (var i = 0; i <= b.length; i++) matrix[i] = [i];
            for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (var i = 1; i <= b.length; i++) {
                for (var j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
                    else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
            return matrix[b.length][a.length];
        }

        // --- Spelling check ---
        function checkSpelling(input, correctWord, icon) {
            const userInput = input.value.trim().toLowerCase();
            const correct = correctWord.toLowerCase();

            if (userInput === correct) {
                if (!input.dataset.solved) {
                    if (typeof TrialGate !== 'undefined' && !TrialGate.allow(correctWord)) { icon.innerHTML = "🔒"; icon.style.display = "inline"; showTrialLock(); return; }
                    WordStats.update(correctWord, true);
                    input.dataset.solved = 'true';
                    playCorrectSound();
                }
                icon.innerHTML = '';
                icon.style.color = 'green';
                icon.style.display = 'inline';
                input.style.borderColor = '#28a745';
                input.style.backgroundColor = '#d4edda';
            } else if (userInput === '') {
                icon.style.display = 'none';
                input.style.borderColor = '#ddd';
                input.style.backgroundColor = '#fafafa';
            } else {
                icon.innerHTML = '';
                icon.style.color = 'red';
                icon.style.display = 'inline';
                input.style.borderColor = '#dc3545';
                input.style.backgroundColor = '#f8d7da';
            }
        }

        function playSound(word) {
            let fellBack = false;
            let audio = null;
            const fallback = () => {
                if (fellBack) return;
                fellBack = true;
                try { if (audio) audio.pause(); } catch (e) {}
                speakFallback(word);
            };
            try {
                audio = new Audio(youdaoAPI + encodeURIComponent(word) + '&type=1');
                audio.volume = 1;
                audio.addEventListener('error', fallback);
                const p = audio.play();
                if (p && p.catch) p.catch(() => fallback());
                setTimeout(() => { if (!fellBack && audio && audio.readyState < 2) fallback(); }, 2500);
            } catch (e) {
                fallback();
            }
        }
        function speakFallback(text) {
            try {
                if (!('speechSynthesis' in window)) return;
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(text);
                u.lang = 'en-US';
                u.volume = 1;
                u.rate = 0.95;
                const vs = speechSynthesis.getVoices();
                for (let i = 0; i < vs.length; i++) { if (/^en[-_]/i.test(vs[i].lang)) { u.voice = vs[i]; break; } }
                speechSynthesis.speak(u);
            } catch (e) {}
        }

        function showSpelling(word) {
                        if (typeof TrialGate !== 'undefined' && !TrialGate.allow(word)) { showTrialLock(); return; }
            WordStats.update(word, false);
            if (spellTimeout) clearTimeout(spellTimeout);

            const spellContainer = document.getElementById('spellContainer');
            const letters = word.split('');

            spellContainer.innerHTML = '<button class="close-spell" onclick="closeSpelling()">x</button>' +
                letters.map(function(letter, index) {
                    return '<span class="spell-letter" style="animation-delay: ' + (index * 0.3) + 's">' + letter + '</span>';
                }).join('');

            spellContainer.style.display = 'flex';
            spellTimeout = setTimeout(function() { closeSpelling(); playSound(word); }, (letters.length * 300) + 2000);
        }

        function closeSpelling() {
            document.getElementById('spellContainer').style.display = 'none';
            if (spellTimeout) { clearTimeout(spellTimeout); spellTimeout = null; }
        }

        document.addEventListener('touchstart', function(){}, true);

        document.addEventListener('touchend', function(event) {
            const now = Date.now();
            if (this.lastTouchEnd && now - this.lastTouchEnd < 350) event.preventDefault();
            this.lastTouchEnd = now;
        }, false);

        // --- Auto-load CSV ---
        async function autoLoadCSV() {
            const lastFilename = localStorage.getItem('last_csv_filename');
            const savedPage = DataPersistence.loadPage();
            let loaded = false;

            if (lastFilename) {
                try {
                    const response = await fetch(lastFilename);
                    if (response.ok) {
                        const text = await response.text();
                        if (text && text.trim().length > 0) {
                            parseCSVData(text, lastFilename, true);
                            const status = document.querySelector('.file-status');
                            status.innerHTML = '已加载: ' + lastFilename + ' <span style="font-size:10px; color:#999;">(已更新)</span>';
                            status.style.color = '#28a745';
                            if (savedPage > 1) showResumeModal(savedPage);
                            else { renderPage(1); renderPagination(); }
                            loaded = true;
                        }
                    }
                } catch (e) {}
            }

            if (!loaded) {
                const lastSession = DataPersistence.load();
                if (lastSession) {
                    parseCSVData(lastSession.content, lastSession.filename, false);
                    const status = document.querySelector('.file-status');
                    status.innerHTML = '已加载: ' + lastSession.filename + ' <span style="font-size:10px; color:#999;">(自动恢复)</span>';
                    status.style.color = '#28a745';
                    if (savedPage > 1) showResumeModal(savedPage);
                    else { renderPage(1); renderPagination(); }
                    loaded = true;
                }
            }

            if (loaded) return;

            const defaultFiles = ['B3U7_ART_P113.csv', 'B3U7 ART P113.csv', 'anki_words.csv'];
            for (var i = 0; i < defaultFiles.length; i++) {
                try {
                    const response = await fetch(defaultFiles[i]);
                    if (response.ok) {
                        const text = await response.text();
                        if (text.trim()) { parseCSVData(text, defaultFiles[i]); return; }
                    }
                } catch (error) {}
            }
            showExampleData();
        }

        function showResumeModal(page) {
            document.getElementById('savedParams').textContent = page;
            document.getElementById('resumeModal').style.display = 'flex';
        }

        function handleResume(resume) {
            document.getElementById('resumeModal').style.display = 'none';
            if (resume) renderPage(DataPersistence.loadPage());
            else renderPage(1);
            renderPagination();
        }

            // --- Built-in textbook word lists (PEP) ---
    var TEXTBOOK_BOOKS = {"g5a": {"title": "PEP 五年级上册", "units": [{"name": "Unit 1", "start": 2, "end": 11, "csv": "old,老的；年纪大的\nyoung,年轻的；岁数不大的\nfunny,滑稽的；可笑的\nkind,体贴的；慈祥的；宽容的\nstrict,要求严格的；严厉的\npolite,有礼貌的；客气的\nhard-working,工作努力的；辛勤的\nhelpful,有用的；愿意帮忙的\nclever,聪明的；聪颖的\nshy,羞怯的；腼腆的\nknow,知道；了解\nour,我们的\nMs,女士\nwill,将要；会\nsometimes,有时；间或\nrobot,机器人\nhim,他（宾格）\nspeak,会说；会讲（语言）\nfinish,完成；做完", "parts": [{"name": "Part A", "csv": "old,老的；年纪大的\nyoung,年轻的；岁数不大的\nfunny,滑稽的；可笑的\nkind,体贴的；慈祥的；宽容的\nstrict,要求严格的；严厉的\nknow,知道；了解\nour,我们的\nMs,女士\nwill,将要；会\nsometimes,有时；间或"}, {"name": "Part B", "csv": "polite,有礼貌的；客气的\nhard-working,工作努力的；辛勤的\nhelpful,有用的；愿意帮忙的\nclever,聪明的；聪颖的\nshy,羞怯的；腼腆的\nrobot,机器人\nhim,他（宾格）\nspeak,会说；会讲（语言）\nfinish,完成；做完"}]}, {"name": "Unit 2", "start": 12, "end": 21, "csv": "Monday,星期一\nTuesday,星期二\nWednesday,星期三\nThursday,星期四\nFriday,星期五\nSaturday,星期六\nSunday,星期日\nweekend,周末\nwash,洗\nwash my clothes,洗我的衣服\nwatch,看\nwatch TV,看电视\ndo,做；干\ndo homework,做作业\nread,看；读\nread books,看书\nplay,踢；玩；参加（体育运动）\nplay football,踢足球\ncooking,烹饪；烹调\noften,时常；常常\npark,公园\ntired,疲倦的；累的\nsport,体育运动\nplay sports,做体育运动\nshould,应该；应当\nevery,每一个；每个\nday,一天；一日\nschedule,工作计划；日程安排", "parts": [{"name": "Part A", "csv": "Monday,星期一\nWednesday,星期三\nThursday,星期四\nFriday,星期五\nweekend,周末\ndo,做；干\nread,看；读\nplay,踢；玩；参加（体育运动）\ncooking,烹饪；烹调\noften,时常；常常\nschedule,工作计划；日程安排"}, {"name": "Part B", "csv": "Tuesday,星期二\nSaturday,星期六\nSunday,星期日\nwash,洗\nwash my clothes,洗我的衣服\nwatch,看\nwatch TV,看电视\ndo homework,做作业\nread books,看书\nplay football,踢足球\npark,公园\ntired,疲倦的；累的\nsport,体育运动\nplay sports,做体育运动\nshould,应该；应当\nevery,每一个；每个\nday,一天；一日"}]}, {"name": "Unit 3", "start": 22, "end": 35, "csv": "sandwich,三明治\nsalad,蔬菜沙拉；混合沙拉\nhamburger,汉堡包\nice cream,冰淇淋\ntea,茶；茶水\nfresh,新鲜的；刚摘的\nhealthy,健康的\ndelicious,美味的；可口的\nhot,辣的；辛辣的\nsweet,含糖的；甜的\ndrink,喝；饮\nthirsty,渴的；口渴的\nfavourite,特别喜爱的\nfood,食物\ndear,亲爱的\nonion,洋葱；葱头", "parts": [{"name": "Part A", "csv": "sandwich,三明治\nsalad,蔬菜沙拉；混合沙拉\nhamburger,汉堡包\nice cream,冰淇淋\ntea,茶；茶水\nhealthy,健康的\nhot,辣的；辛辣的\nsweet,含糖的；甜的\ndrink,喝；饮\nthirsty,渴的；口渴的\nfood,食物"}, {"name": "Part B", "csv": "fresh,新鲜的；刚摘的\ndelicious,美味的；可口的\nfavourite,特别喜爱的\ndear,亲爱的\nonion,洋葱；葱头"}]}, {"name": "Unit 4", "start": 36, "end": 45, "csv": "sing,唱；唱歌\nsong,歌曲\nsing English songs,唱英文歌曲\nplay the pipa,弹琵琶\nkung fu,功夫；武术\ndo kung fu,练功夫\ndance,跳舞\ndraw,画\ncartoon,漫画\ndraw cartoons,画漫画\ncook,烹调；烹饪\nswim,游泳\nplay basketball,打篮球\nping-pong,乒乓球\nplay ping-pong,打乒乓球\nspeak English,说英语\nwe'll,我们将\nparty,聚会；派对\nnext,下一个的；接下来的\nwonderful,极好的；了不起的\nlearn,学；学习；学会\nany,任何的；任一的\nproblem,问题\nno problem,没问题\nwant,要；想要\nsend,邮寄；发送\nemail,电子邮件\nat,（后面接邮件地址）", "parts": [{"name": "Part A", "csv": "sing,唱；唱歌\nsing English songs,唱英文歌曲\nplay the pipa,弹琵琶\nkung fu,功夫；武术\ndo kung fu,练功夫\ndance,跳舞\ndraw,画\ncartoon,漫画\ndraw cartoons,画漫画\ncook,烹调；烹饪\nping-pong,乒乓球\nplay ping-pong,打乒乓球\nwe'll,我们将\nparty,聚会；派对\nnext,下一个的；接下来的\nwonderful,极好的；了不起的\nlearn,学；学习；学会\nat,（后面接邮件地址）"}, {"name": "Part B", "csv": "song,歌曲\nswim,游泳\nplay basketball,打篮球\nspeak English,说英语\nany,任何的；任一的\nproblem,问题\nno problem,没问题\nwant,要；想要\nsend,邮寄；发送\nemail,电子邮件"}]}, {"name": "Unit 5", "start": 46, "end": 55, "csv": "clock,时钟；钟\nplant,植物\nbottle,瓶子\nwater bottle,水瓶\nbike,自行车；脚踏车\nphoto,照片；相片\nfront,正面\nin front of,在……前面\nbetween,在……中间\nabove,在（或向）……上面\nbeside,在旁边（附近）\nbehind,在（或向）……后面\nthere,（表示存在或发生）\ngrandfather,祖父；外祖父\ntheir,他（她，它）们的\nhouse,房屋；房子；住宅\nlot,大量；许多\nlots of,大量；许多\nflower,花；花朵\nmove,搬家\ndirty,肮脏的\neverywhere,处处；到处\nmouse,老鼠\nlive,住；居住\nnature,自然界；大自然", "parts": [{"name": "Part A", "csv": "clock,时钟；钟\nplant,植物\nbottle,瓶子\nwater bottle,水瓶\nbike,自行车；脚踏车\nphoto,照片；相片\nabove,在（或向）……上面\nbeside,在旁边（附近）\nthere,（表示存在或发生）"}, {"name": "Part B", "csv": "front,正面\nin front of,在……前面\nbetween,在……中间\nbehind,在（或向）……后面\ngrandfather,祖父；外祖父\ntheir,他（她，它）们的\nhouse,房屋；房子；住宅\nlot,大量；许多\nlots of,大量；许多\nflower,花；花朵\nmove,搬家\ndirty,肮脏的\neverywhere,处处；到处\nmouse,老鼠\nlive,住；居住\nnature,自然界；大自然"}]}, {"name": "Unit 6", "start": 56, "end": 65, "csv": "forest,森林；林区\nriver,河；江\nlake,湖；湖泊\nmountain,高山；山岳\nhill,山丘；小山\ntree,树；树木；乔木\nbridge,桥\nbuilding,建筑物；房子；楼房\nvillage,村庄；村镇\nhouse,房屋；房子；住宅\nboating,划船\ngo boating,去划船\naren't,不是（are not）\nrabbit,兔；野兔\nhigh,高的", "parts": [{"name": "Part A", "csv": "forest,森林；林区\nriver,河；江\nlake,湖；湖泊\nmountain,高山；山岳\nhill,山丘；小山\nhouse,房屋；房子；住宅\nboating,划船\ngo boating,去划船"}, {"name": "Part B", "csv": "tree,树；树木；乔木\nbridge,桥\nbuilding,建筑物；房子；楼房\nvillage,村庄；村镇\naren't,不是（are not）\nrabbit,兔；野兔\nhigh,高的"}]}]}, "g5b": {"title": "PEP 五年级下册", "units": [{"name": "Unit 1", "start": 2, "end": 11, "csv": "eat breakfast,吃早饭\nhave...class,上……课\nplay sports,进行体育运动\nexercise,活动；运动\ndo morning exercises,做早操\neat dinner,吃晚饭\nclean my room,打扫我的房间\ngo for a walk,散步\ngo shopping,去买东西；购物\ntake,学习；上（课）\ndancing,跳舞；舞蹈\ntake a dancing class,上舞蹈课\nwhen,什么时候；何时\nafter,在（时间）后\nstart,开始\nusually,通常地；惯常地\nSpain,西班牙\nlate,晚；迟\na.m.,午前；上午\np.m.,午后；下午\nwhy,为什么\nshop,去买东西；购物\nwork,工作\nlast,上一个的；刚过去的\nsound,听起来好像\nalso,还；也\nbusy,忙的\nneed,需要\nplay,戏剧；剧本\nletter,信\nlive,居住\nisland,岛\nalways,总是；一直\ncave,山洞；洞穴\ngo swimming,去游泳\nwin,获胜", "parts": [{"name": "Part A", "csv": "eat breakfast,吃早饭\nhave...class,上……课\nplay sports,进行体育运动\nexercise,活动；运动\ndo morning exercises,做早操\neat dinner,吃晚饭\nclean my room,打扫我的房间\ngo shopping,去买东西；购物\nwhen,什么时候；何时\nafter,在（时间）后\nstart,开始\nusually,通常地；惯常地\nSpain,西班牙\nlate,晚；迟\na.m.,午前；上午\nshop,去买东西；购物\nwork,工作\nplay,戏剧；剧本"}, {"name": "Part B", "csv": "go for a walk,散步\ntake,学习；上（课）\ndancing,跳舞；舞蹈\ntake a dancing class,上舞蹈课\np.m.,午后；下午\nwhy,为什么\nlast,上一个的；刚过去的\nsound,听起来好像\nalso,还；也\nbusy,忙的\nneed,需要\nletter,信\nlive,居住\nisland,岛\nalways,总是；一直\ncave,山洞；洞穴\ngo swimming,去游泳\nwin,获胜"}]}, {"name": "Unit 2", "start": 12, "end": 21, "csv": "spring,春天\nsummer,夏天\nautumn,秋天\nwinter,冬天\nseason,季节\npicnic,野餐\ngo on a picnic,去野餐\npick,摘；采集\npick apples,摘苹果\nsnowman,雪人\nmake a snowman,堆雪人\ngo swimming,去游泳\nwhich,哪一个\nbest,最；极\nsnow,雪\ngood job,做得好\nbecause,因为\nvacation,假期\nall,完全；全部\npink,粉色\nlovely,可爱的\nleaf,叶子\nfall,落下；跌落\npaint,绘画", "parts": [{"name": "Part A", "csv": "spring,春天\nsummer,夏天\nautumn,秋天\nwinter,冬天\nseason,季节\ngo swimming,去游泳\nwhich,哪一个\nbest,最；极\nbecause,因为"}, {"name": "Part B", "csv": "picnic,野餐\ngo on a picnic,去野餐\npick,摘；采集\npick apples,摘苹果\nsnowman,雪人\nmake a snowman,堆雪人\nsnow,雪\ngood job,做得好\nvacation,假期\nall,完全；全部\npink,粉色\nlovely,可爱的\nleaf,叶子\nfall,落下；跌落\npaint,绘画"}]}, {"name": "Unit 3", "start": 22, "end": 35, "csv": "January,一月\nFebruary,二月\nMarch,三月\nApril,四月\nMay,五月\nJune,六月\nJuly,七月\nAugust,八月\nSeptember,九月\nOctober,十月\nNovember,十一月\nDecember,十二月\nfew,不多；很少\na few,一些\nthing,事情\nmeet,集会；会面\nsports meet,运动会\nEaster,复活节\ntrip,旅行\nyear,年\nplant,种植\ncontest,比赛；竞赛\nthe Great Wall,长城\nnational,国家的\nNational Day,国庆日\nAmerican,美国的\nThanksgiving,感恩节\nChristmas,圣诞节\nholiday,假日；节日\ngame,游戏\nroll,滚动\nlook for,寻找\nchocolate,巧克力\nbunny,兔子\nRSVP,请赐复\nby,在……之前", "parts": [{"name": "Part A", "csv": "January,一月\nFebruary,二月\nMarch,三月\nApril,四月\nMay,五月\nJuly,七月\nAugust,八月\nfew,不多；很少\na few,一些\nthing,事情\nmeet,集会；会面\nsports meet,运动会\ntrip,旅行\nyear,年\nplant,种植\ncontest,比赛；竞赛"}, {"name": "Part B", "csv": "June,六月\nSeptember,九月\nOctober,十月\nNovember,十一月\nDecember,十二月\nEaster,复活节\nthe Great Wall,长城\nnational,国家的\nNational Day,国庆日\nAmerican,美国的\nThanksgiving,感恩节\nChristmas,圣诞节\nholiday,假日；节日\ngame,游戏\nroll,滚动\nlook for,寻找\nchocolate,巧克力\nbunny,兔子\nRSVP,请赐复\nby,在……之前"}]}, {"name": "Unit 4", "start": 36, "end": 45, "csv": "first,第一（的）\nsecond,第二（的）\nthird,第三（的）\nfourth,第四（的）\nfifth,第五（的）\ntwelfth,第十二（的）\ntwentieth,第二十（的）\ntwenty-first,第二十一（的）\ntwenty-third,第二十三（的）\nthirtieth,第三十（的）\nspecial,特殊的；特别的\nfool,蠢人；傻瓜\nkitten,小猫\ndiary,日记\nstill,仍然\nnoise,噪音\nfur,动物皮毛\nopen,开着的\nwalk,行走", "parts": [{"name": "Part A", "csv": "third,第三（的）\nfourth,第四（的）\nfifth,第五（的）\nspecial,特殊的；特别的"}, {"name": "Part B", "csv": "first,第一（的）\nsecond,第二（的）\ntwelfth,第十二（的）\ntwentieth,第二十（的）\ntwenty-first,第二十一（的）\ntwenty-third,第二十三（的）\nthirtieth,第三十（的）\nfool,蠢人；傻瓜\nkitten,小猫\ndiary,日记\nstill,仍然\nnoise,噪音\nfur,动物皮毛\nopen,开着的\nwalk,行走"}]}, {"name": "Unit 5", "start": 46, "end": 55, "csv": "mine,我的\nyours,你（们）的\nhis,他的\nhers,她的\ntheirs,他（她，它）们的\nours,我们的\nclimbing,（正在）攀登；攀爬\neating,（正在）吃\nplaying,（正在）玩耍\njumping,（正在）跳\ndrinking,（正在）喝\nsleeping,（正在）睡觉\neach,每个；各个\nother,其他\neach other,互相\nexcited,兴奋的\nlike,像……那样", "parts": [{"name": "Part A", "csv": "mine,我的\nyours,你（们）的\nhis,他的\nhers,她的\ntheirs,他（她，它）们的\nours,我们的\neating,（正在）吃\nplaying,（正在）玩耍\njumping,（正在）跳"}, {"name": "Part B", "csv": "climbing,（正在）攀登；攀爬\ndrinking,（正在）喝\nsleeping,（正在）睡觉\neach,每个；各个\nother,其他\neach other,互相\nexcited,兴奋的\nlike,像……那样"}]}, {"name": "Unit 6", "start": 56, "end": 65, "csv": "doing morning exercises,（正在）做早操\nhaving...class,（正在）上……课\neating lunch,（正在）吃午饭\nreading a book,（正在）看书\nlistening to music,（正在）听音乐\nkeep,保持\nkeep to the right,靠右\nkeep your desk clean,保持你的课桌干净\ntalk quietly,小声讲话\nturn,顺序\ntake turns,按顺序来\nbamboo,竹子\nits,它的\nshow,展示；给……看\nanything,任何事物\nelse,另外；其他\nexhibition,展览\nsay,说；讲\nhave a look,看一看\nsushi,寿司\nteach,教\nsure,当然\nCanadian,加拿大的\nSpanish,西班牙的", "parts": [{"name": "Part A", "csv": "doing morning exercises,（正在）做早操\nhaving...class,（正在）上……课\neating lunch,（正在）吃午饭\nreading a book,（正在）看书\nlistening to music,（正在）听音乐\nkeep,保持\nkeep to the right,靠右\nbamboo,竹子\nits,它的\nsay,说；讲"}, {"name": "Part B", "csv": "keep your desk clean,保持你的课桌干净\ntalk quietly,小声讲话\nturn,顺序\ntake turns,按顺序来\nshow,展示；给……看\nanything,任何事物\nelse,另外；其他\nexhibition,展览\nhave a look,看一看\nsushi,寿司\nteach,教\nsure,当然\nCanadian,加拿大的\nSpanish,西班牙的"}]}]}, "g6a": {"title": "PEP 六年级上册", "units": [{"name": "Unit 1", "start": 2, "end": 11, "csv": "science,科学\nmuseum,博物馆\npost office,邮局\nbookstore,书店\ncinema,电影院\nhospital,医院\ncrossing,十字路口\nturn,转弯\nleft,左\nstraight,笔直地\nright,右\nask,问\nsir,先生\ninteresting,有趣的\nItalian,意大利的\nrestaurant,餐馆\npizza,比萨饼\nstreet,大街；街道\nget,到达\nBDS,北斗卫星导航系统\ngave,提供；交给\nfeature,特点\nfollow,跟着\nfar,远的\ntell,告诉", "parts": [{"name": "Part A", "csv": "science,科学\nmuseum,博物馆\npost office,邮局\nbookstore,书店\ncinema,电影院\nhospital,医院\nask,问\nsir,先生\nget,到达"}, {"name": "Part B", "csv": "crossing,十字路口\nturn,转弯\nleft,左\nstraight,笔直地\nright,右\ninteresting,有趣的\nItalian,意大利的\nrestaurant,餐馆\npizza,比萨饼\nstreet,大街；街道\nBDS,北斗卫星导航系统\ngave,提供；交给\nfeature,特点\nfollow,跟着\nfar,远的\ntell,告诉"}]}, {"name": "Unit 2", "start": 12, "end": 21, "csv": "on foot,步行\nby,乘\nbus,公共汽车\nplane,飞机\ntaxi,出租汽车\nship,（大）船\nsubway,地铁\ntrain,火车\nslow,慢的\ndown,减少；降低\nslow down,慢下来\nstop,停下\nMrs,夫人\nearly,早到的\nhelmet,头盔\nmust,必须\nwear,穿；戴\nattention,注意\npay attention to,注意\ntraffic,交通\ntraffic lights,交通信号灯\nMunich,慕尼黑\nGermany,德国\nAlaska,阿拉斯加州\nsled,雪橇\nfast,快\nferry,轮渡\nPapa Westray,帕帕韦斯特雷岛\nScotland,苏格兰", "parts": [{"name": "Part A", "csv": "on foot,步行\nby,乘\nbus,公共汽车\nplane,飞机\ntaxi,出租汽车\nship,（大）船\nsubway,地铁\ntrain,火车\nMrs,夫人\nearly,早到的"}, {"name": "Part B", "csv": "slow,慢的\ndown,减少；降低\nslow down,慢下来\nstop,停下\nhelmet,头盔\nmust,必须\nwear,穿；戴\nattention,注意\npay attention to,注意\ntraffic,交通\ntraffic lights,交通信号灯\nMunich,慕尼黑\nGermany,德国\nAlaska,阿拉斯加州\nsled,雪橇\nfast,快\nferry,轮渡\nPapa Westray,帕帕韦斯特雷岛\nScotland,苏格兰"}]}, {"name": "Unit 3", "start": 22, "end": 35, "csv": "visit,拜访\nfilm,电影\nsee a film,看电影\ntrip,旅行\ntake a trip,去旅行\nsupermarket,超市\nevening,晚上；傍晚\ntonight,在今晚\ntomorrow,明天\nnext week,下周\ndictionary,词典\ncomic,滑稽的\ncomic book,连环画册\nword,单词\nword book,单词书\npostcard,明信片\nlesson,课\nspace,太空\ntravel,（尤指长途）旅行\nhalf,一半\nprice,价格\nMid-Autumn Festival,中秋节\ntogether,一起\nget together,聚会\nmooncake,月饼\npoem,诗\nmoon,月亮", "parts": [{"name": "Part A", "csv": "visit,拜访\nfilm,电影\nsee a film,看电影\ntrip,旅行\ntake a trip,去旅行\nsupermarket,超市\nevening,晚上；傍晚\ntonight,在今晚\ntomorrow,明天\nnext week,下周\ncomic,滑稽的\ncomic book,连环画册\nlesson,课"}, {"name": "Part B", "csv": "dictionary,词典\nword,单词\nword book,单词书\npostcard,明信片\nspace,太空\ntravel,（尤指长途）旅行\nhalf,一半\nprice,价格\nMid-Autumn Festival,中秋节\ntogether,一起\nget together,聚会\nmooncake,月饼\npoem,诗\nmoon,月亮"}]}, {"name": "Unit 4", "start": 36, "end": 45, "csv": "studies,学习\npuzzle,谜\nhiking,远足\npen pal,笔友\nhobby,业余爱好\njasmine,茉莉\nidea,想法；主意\nCanberra,堪培拉\namazing,令人惊奇的\nshall,表示征求意见\ngoal,射门\njoin,加入\nclub,俱乐部\nshare,分享", "parts": [{"name": "Part A", "csv": "pen pal,笔友\njasmine,茉莉\nidea,想法；主意"}, {"name": "Part B", "csv": "studies,学习\npuzzle,谜\nhiking,远足\nhobby,业余爱好\nCanberra,堪培拉\namazing,令人惊奇的\nshall,表示征求意见\ngoal,射门\njoin,加入\nclub,俱乐部\nshare,分享"}]}, {"name": "Unit 5", "start": 46, "end": 55, "csv": "factory,工厂\nworker,工人\npostman,邮递员\nbusinessman,商人；企业家\npolice officer,警察\nfisherman,渔民\nscientist,科学家\npilot,飞行员\ncoach,教练\ncountry,国家\nhead teacher,校长\nsea,大海\nstay,保持\nuniversity,大学\ngym,体育馆\nif,如果\nreporter,记者\nuse,使用\ntype,打字\nquickly,迅速地\nsecretary,秘书", "parts": [{"name": "Part A", "csv": "factory,工厂\nworker,工人\npostman,邮递员\nbusinessman,商人；企业家\npolice officer,警察\npilot,飞行员\nhead teacher,校长\nsea,大海"}, {"name": "Part B", "csv": "fisherman,渔民\nscientist,科学家\ncoach,教练\ncountry,国家\nstay,保持\nuniversity,大学\ngym,体育馆\nif,如果\nreporter,记者\nuse,使用\ntype,打字\nquickly,迅速地\nsecretary,秘书"}]}, {"name": "Unit 6", "start": 56, "end": 65, "csv": "angry,生气的\nafraid,害怕\nsad,难过的\nworried,担心的；发愁的\nhappy,高兴的\nsee a doctor,看病\nwear,穿\nmore,更多的\ndeep,深的\nbreath,呼吸\ntake a deep breath,深深吸一口气\ncount,数数\ncount to ten,数到十\nchase,追赶\nmice,老鼠（mouse的复数）\nbad,邪恶的；坏的\nhurt,（使）受伤\nill,有病；不舒服\nwrong,有毛病\nshould,应该\nfeel,觉得；感到\nwell,健康；身体好\nsit,坐\ngrass,草坪\nhear,听见\nant,蚂蚁\nworry,担心；担忧\nstuck,陷住；无法移动\nmud,泥\npull,拉；拽\neveryone,每人", "parts": [{"name": "Part A", "csv": "angry,生气的\nafraid,害怕\nsad,难过的\nworried,担心的；发愁的\nhappy,高兴的\nsee a doctor,看病\ndeep,深的\nbreath,呼吸\ncount,数数\ncount to ten,数到十\nmice,老鼠（mouse的复数）\nbad,邪恶的；坏的\nhurt,（使）受伤\nill,有病；不舒服\nshould,应该\nfeel,觉得；感到\nwell,健康；身体好"}, {"name": "Part B", "csv": "wear,穿\nmore,更多的\ntake a deep breath,深深吸一口气\nchase,追赶\nwrong,有毛病\nsit,坐\ngrass,草坪\nhear,听见\nant,蚂蚁\nworry,担心；担忧\nstuck,陷住；无法移动\nmud,泥\npull,拉；拽\neveryone,每人"}]}]}, "g6b": {"title": "PEP 六年级下册", "units": [{"name": "Unit 1", "start": 2, "end": 11, "csv": "younger,更年轻的\nolder,更年长的\ntaller,更高的\nshorter,更矮的；更短的\nlonger,更长的\nthinner,更瘦的\nheavier,更重的\nbigger,更大的\nsmaller,更小的\nstronger,更强壮的\ndinosaur,恐龙\nhall,大厅\nmetre,米\nthan,比\nboth,两个都\nkilogram,千克；公斤\ncountryside,乡村\nlower,更低地\nshadow,阴影；影子\nsmarter,更聪明的\nbecome,开始变得；变成", "parts": [{"name": "Part A", "csv": "younger,更年轻的\nolder,更年长的\ntaller,更高的\nshorter,更矮的；更短的\nlonger,更长的\ndinosaur,恐龙\nhall,大厅\nmetre,米\nthan,比\nboth,两个都"}, {"name": "Part B", "csv": "thinner,更瘦的\nheavier,更重的\nbigger,更大的\nsmaller,更小的\nstronger,更强壮的\nkilogram,千克；公斤\ncountryside,乡村\nlower,更低地\nshadow,阴影；影子\nsmarter,更聪明的\nbecome,开始变得；变成"}]}, {"name": "Unit 2", "start": 12, "end": 21, "csv": "cleaned,打扫\nstayed,停留；待\nwashed,洗\nwatched,看\nhad,患病；得病\nhad a cold,感冒\nslept,睡觉\nread,读\nsaw,看见\nlast,最近的；上一个的\nyesterday,昨天\nbefore,在……之前\ndrank,喝\nshow,演出\nmagazine,杂志\nbetter,更好的\nfaster,更快的\nhotel,旅馆\nfixed,修理\nbroken,破损的\nlamp,台灯\nloud,喧闹的；大声的\nenjoy,享受……乐趣；喜爱\nstay,暂住；逗留", "parts": [{"name": "Part A", "csv": "cleaned,打扫\nstayed,停留；待\nwashed,洗\nwatched,看\nlast,最近的；上一个的\ndrank,喝\nshow,演出"}, {"name": "Part B", "csv": "had,患病；得病\nhad a cold,感冒\nslept,睡觉\nread,读\nsaw,看见\nyesterday,昨天\nbefore,在……之前\nmagazine,杂志\nbetter,更好的\nfaster,更快的\nhotel,旅馆\nfixed,修理\nbroken,破损的\nlamp,台灯\nloud,喧闹的；大声的\nenjoy,享受……乐趣；喜爱\nstay,暂住；逗留"}]}, {"name": "Unit 3", "start": 22, "end": 31, "csv": "went,去\ncamp,野营\nwent camping,野营\nfish,钓鱼；捕鱼\nwent fishing,去钓鱼\nrode,骑（马；自行车）\nhurt,（使）受伤\nate,吃\ntook,拍照\ntook pictures,照相\nbought,买\ngift,礼物\nfell,摔倒\noff,从（某处）落下\nLabour Day,劳动节\nmule,骡子\nTurpan,吐鲁番\ncould,能\ntill,直到\nbeach,海滩；沙滩\nbasket,篮；筐\npart,角色\nlicked,舔\nlaughed,笑", "parts": [{"name": "Part A", "csv": "went,去\ncamp,野营\nwent camping,野营\nfish,钓鱼；捕鱼\nwent fishing,去钓鱼\nrode,骑（马；自行车）\nhurt,（使）受伤\nate,吃\nfell,摔倒\noff,从（某处）落下\nLabour Day,劳动节\nmule,骡子\nTurpan,吐鲁番\ntill,直到"}, {"name": "Part B", "csv": "took,拍照\ntook pictures,照相\nbought,买\ngift,礼物\ncould,能\nbeach,海滩；沙滩\nbasket,篮；筐\npart,角色\nlicked,舔\nlaughed,笑"}]}, {"name": "Unit 4", "start": 32, "end": 41, "csv": "dining hall,饭厅\ngrass,草坪\ngym,体育馆\nago,以前\ncycling,骑自行车运动\ngo cycling,去骑自行车\nice-skate,滑冰\nbadminton,羽毛球运动\nstar,星\neasy,容易的\nlook up,查阅\nInternet,互联网\ndifferent,不同的\nactive,积极的；活跃的\nrace,赛跑\nnothing,没有什么\nthought,想\nfelt,感觉\ncheetah,猎豹\ntrip,绊倒\nwoke,醒\ndream,梦", "parts": [{"name": "Part A", "csv": "dining hall,饭厅\ngrass,草坪\ngym,体育馆\nago,以前\nInternet,互联网"}, {"name": "Part B", "csv": "cycling,骑自行车运动\ngo cycling,去骑自行车\nice-skate,滑冰\nbadminton,羽毛球运动\nstar,星\neasy,容易的\nlook up,查阅\ndifferent,不同的\nactive,积极的；活跃的\nrace,赛跑\nnothing,没有什么\nthought,想\nfelt,感觉\ncheetah,猎豹\ntrip,绊倒\nwoke,醒\ndream,梦"}]}]}};
    // 教材分组：以后加初中时，只需在 TEXTBOOK_BOOKS 里加词表、再往这里加一组即可，界面自动生成按钮
    var TEXTBOOK_STAGES = [
        { stage: '小学', books: [ { key: 'g5a', short: '5上' }, { key: 'g5b', short: '5下' }, { key: 'g6a', short: '6上' }, { key: 'g6b', short: '6下' } ] }
    ];
    function mergeUnitCSVs(units) {
        var seen = {}, out = [];
        units.forEach(function(u) { u.csv.split('\n').forEach(function(line) { line = line.trim(); if (!line) return; var w = line.split(',')[0].trim().toLowerCase(); if (seen[w]) return; seen[w] = 1; out.push(line); }); });
        return out.join('\n');
    }
    function bookCount(key) { return mergeUnitCSVs(TEXTBOOK_BOOKS[key].units).split('\n').length; }
    var tbBarOpen = true;
function toggleTbBar() { tbBarOpen = !tbBarOpen; var b = document.getElementById('tbBody'); if (b) b.style.display = tbBarOpen ? 'contents' : 'none'; var t = document.getElementById('tbTri'); if (t) t.textContent = tbBarOpen ? '▼' : '▶'; }
var unitBarOpen = true;
function toggleUnitBar() { unitBarOpen = !unitBarOpen; var b = document.getElementById('unitBody'); if (b) b.style.display = unitBarOpen ? 'contents' : 'none'; var t = document.getElementById('unitTri'); if (t) t.textContent = unitBarOpen ? '▼' : '▶'; }
function foldUnitBar() { unitBarOpen = false; var b = document.getElementById('unitBody'); if (b) b.style.display = 'none'; var t = document.getElementById('unitTri'); if (t) t.textContent = '▶'; }
function initCollapsibleSections() {
    var modal = document.getElementById('diyModal');
    if (!modal || modal.getAttribute('data-sec-init')) return;
    modal.setAttribute('data-sec-init', '1');
    var heads = modal.querySelectorAll('h3');
    for (var hi = 0; hi < heads.length; hi++) {
        (function(h) {
            var body = document.createElement('div');
            body.className = 'sec-body';
            var nodes = [];
            var node = h.nextSibling;
            while (node && node.tagName !== 'H3') { nodes.push(node); node = node.nextSibling; }
            if (nodes.length) h.parentNode.insertBefore(body, nodes[0]); else h.parentNode.appendChild(body);
            for (var ni = 0; ni < nodes.length; ni++) body.appendChild(nodes[ni]);
            var open = h.textContent.indexOf('家长挑词') >= 0;
            h.classList.add('sec-head');
            h.innerHTML = '<span class="sec-tri">' + (open ? '▼' : '▶') + '</span>' + h.innerHTML;
            body.style.display = open ? '' : 'none';
            h.addEventListener('click', function() {
                var isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : '';
                var tri = h.querySelector('.sec-tri');
                if (tri) tri.textContent = isOpen ? '▶' : '▼';
            });
        })(heads[hi]);
    }
}
function renderTextbookBar() {
        var bar = document.getElementById('textbookBar');
        if (!bar || typeof TEXTBOOK_BOOKS === 'undefined') return;
        var html = '';
        TEXTBOOK_STAGES.forEach(function(g) {
            html += '<span class="textbook-label unit-toggle" onclick="toggleTbBar()"><span id="tbTri">' + (tbBarOpen ? '▼' : '▶') + '</span> 📚 教材词库 · ' + g.stage + '</span><span id="tbBody" style="display:' + (tbBarOpen ? 'contents' : 'none') + '">';
            g.books.forEach(function(it) {
                var b = TEXTBOOK_BOOKS[it.key];
                if (!b) return;
                html += '<button class="tb-btn" onclick="loadTextbook(\'' + it.key + '\')">' + it.short + '<span class="tb-sub">' + b.title.replace('PEP ', '') + ' · ' + bookCount(it.key) + '词</span></button>';
            });
            html += '</span>';
        });
        bar.innerHTML = html;
    }
    var TEXTBOOK_SENTENCES = {"g5a": {"Unit 1": [["Ms Wang will be our new Chinese teacher.", "王老师将是我们的新语文老师。"], ["We have a new PE teacher.", "我们有一位新体育老师。"], ["He's a good football player.", "他足球踢得很好。"], ["What's he like?", "他是个什么样的人？"], ["Do you know Mr Young?", "你认识杨老师吗？"], ["He's our music teacher.", "他是我们的音乐老师。"], ["Is he young?", "他年轻吗？"], ["No, he isn't.", "不，他不年轻。"], ["Is he funny?", "他幽默吗？"], ["Yes, he is.", "是的，他很幽默。"], ["What's she like?", "她是个什么样的人？"], ["She's very kind.", "她很和善。"], ["Is she strict?", "她严格吗？"], ["Yes, sometimes.", "是的，有时候很严格。"], ["Who's your English teacher?", "你的英语老师是谁？"], ["She's the head teacher.", "她是校长。"], ["His name is Robin.", "他的名字叫罗宾。"], ["Robin is short but strong.", "罗宾个子矮，但很强壮。"], ["He can speak Chinese and English.", "他会说中文和英文。"], ["He makes me finish my homework!", "他让我必须做完作业！"]], "Unit 2": [["What do you have on Fridays?", "你们周五有什么课？"], ["I have a PE class.", "我有一节体育课。"], ["What do you have on Wednesdays?", "你们周三有什么课？"], ["I have maths, English and music.", "我有数学、英语和音乐。"], ["Who's your music teacher?", "你的音乐老师是谁？"], ["What do you do on Thursdays, Grandpa?", "爷爷，你周四做什么？"], ["I have a cooking class with your grandma!", "我和你奶奶一起上烹饪课！"], ["Do you often play sports?", "你经常做运动吗？"], ["No, I don't. I don't like sports.", "不，我不经常。我不喜欢运动。"], ["Do you often read books in this park?", "你经常在这个公园里看书吗？"], ["Yes, I do.", "是的，我经常看。"], ["I like this park very much.", "我非常喜欢这个公园。"], ["I often do homework, watch TV and draw pictures on the weekend.", "我周末经常写作业、看电视、画画。"], ["You look tired.", "你看起来很累。"], ["You should play sports every day.", "你应该每天做运动。"], ["Here is a new schedule for you.", "这是给你的新时间表。"], ["We have English on Mondays and Wednesdays.", "我们周一和周三有英语课。"], ["We don't have enough money.", "我们的钱不够。"]], "Unit 3": [["What would you like to eat?", "你想吃什么？"], ["I'd like some noodles.", "我想吃面条。"], ["What would you like to drink?", "你想喝什么？"], ["A sandwich, please.", "请来一个三明治。"], ["I'd like some water.", "我想喝点水。"], ["Here you are.", "给你。"], ["The sandwich is delicious.", "三明治很好吃。"], ["What's your favourite food?", "你最喜欢的食物是什么？"], ["Sarah's favourite food is fish.", "萨拉最喜欢的食物是鱼。"], ["Her favourite drink is milk.", "她最喜欢的饮料是牛奶。"], ["I love beef noodles.", "我爱吃牛肉面。"], ["We have beef noodles and fish sandwiches today.", "我们今天有牛肉面和鱼肉三明治。"], ["My favourite food is ice cream.", "我最喜欢的食物是冰淇淋。"], ["It is sweet.", "它很甜。"], ["I don't like beef but chicken is OK.", "我不喜欢牛肉，但鸡肉还可以。"], ["Onions are my favourite vegetable.", "洋葱是我最喜欢的蔬菜。"], ["I like salad very much.", "我非常喜欢沙拉。"], ["Don't eat too much!", "别吃太多了！"]], "Unit 4": [["We'll have an English party next Tuesday.", "下周二我们要开英语派对。"], ["What can you do for the party?", "你能为派对做什么？"], ["I can sing English songs.", "我会唱英文歌。"], ["I can do some kung fu!", "我会一点功夫！"], ["I can draw pictures.", "我会画画。"], ["Can you do any kung fu, John?", "约翰，你会功夫吗？"], ["No, I can't.", "不，我不会。"], ["No problem. I can help you.", "没关系。我可以帮你。"], ["I can speak English and Chinese.", "我会说英语和中文。"], ["I can play ping-pong.", "我会打乒乓球。"], ["I can't do any kung fu.", "我一点功夫也不会。"], ["I am Robin the Robot!", "我是机器人罗宾！"], ["I am friendly and funny.", "我友好又有趣。"], ["I can play ping-pong, but I can't swim.", "我会打乒乓球，但不会游泳。"], ["Do you want to be Robin's friend?", "你想成为罗宾的朋友吗？"], ["Can you play ping-pong?", "你会打乒乓球吗？"], ["Let's play together!", "我们一起玩吧！"]], "Unit 5": [["Your room is really nice!", "你的房间真不错！"], ["There is a big bed.", "有一张大床。"], ["I like my bed.", "我喜欢我的床。"], ["There is a nice photo, too.", "还有一张漂亮的照片。"], ["You look cool!", "你看起来很酷！"], ["There is a clock, a plant and a photo in my room.", "我的房间里有时钟、植物和照片。"], ["This is the living room.", "这是客厅。"], ["There are so many pictures here.", "这里有好多画。"], ["My grandparents have a garden in front of their house.", "我祖父母的房子前面有个花园。"], ["There are lots of flowers in it.", "里面有很多花。"], ["Where is the ball?", "球在哪里？"], ["There is a tree in front of the house.", "房子前面有一棵树。"], ["I just moved into an old house.", "我刚搬进一所老房子。"], ["The rooms are dirty.", "房间很脏。"], ["There are pictures and photos everywhere.", "到处都是画和照片。"], ["I see a mouse behind my computer!", "我看见一只老鼠在我电脑后面！"], ["Please help me.", "请帮帮我。"]], "Unit 6": [["Is there a river in the forest, Miss White?", "怀特老师，森林里有河吗？"], ["No, there isn't.", "不，没有。"], ["Is there a lake, Miss White?", "怀特老师，有湖吗？"], ["Yes, there is, and there are some small boats.", "有，还有一些小船。"], ["Let's go boating.", "我们去划船吧。"], ["Are there any lakes in the park?", "公园里有湖吗？"], ["No, there aren't.", "没有。"], ["The nature park is so quiet!", "自然公园好安静啊！"], ["There aren't many people.", "这里人不多。"], ["Are there any tall buildings in the nature park?", "自然公园里有高楼吗？"], ["Are there any animals?", "有动物吗？"], ["Yes, there are. There are ducks and rabbits.", "有，有鸭子和兔子。"], ["There is a village in the nature park.", "自然公园里有个村庄。"], ["There is a nature park near the house.", "房子附近有个自然公园。"], ["In front of the mountain there is a small village.", "山前面有个小村庄。"], ["There are many ducks on the lake.", "湖里有很多鸭子。"], ["Robin would like to draw a picture of the park.", "罗宾想画一张公园的画。"]]}, "g5b": {"Unit 1": [["When do you get up?", "你几点起床？"], ["I often get up at 7 o'clock.", "我经常7点起床。"], ["I always start class at 8 o'clock.", "我总是8点开始上课。"], ["When do you finish class in the morning?", "你们上午几点下课？"], ["We finish class at 1 o'clock.", "我们1点下课。"], ["Then we eat lunch at home.", "然后我们在家吃午饭。"], ["When do you go back to school after lunch?", "午饭后你几点回学校？"], ["Classes start at 3 o'clock.", "课程3点开始。"], ["That's too late!", "那太晚了！"], ["What do you do on the weekend?", "你周末做什么？"], ["I often go shopping with my mum.", "我经常和妈妈去购物。"], ["Why are you shopping today?", "你今天为什么买东西？"], ["My mum worked last night.", "我妈妈昨晚工作了。"], ["That sounds like a lot of fun.", "那听起来很有趣。"], ["You're so busy!", "你真忙！"], ["You need a robot to help you!", "你需要一个机器人帮你！"], ["I live on an island.", "我住在一个岛上。"], ["I always get up early every day.", "我每天都早起。"]], "Unit 2": [["Which season do you like best?", "你最喜欢哪个季节？"], ["I like spring best.", "我最喜欢春天。"], ["There are beautiful flowers everywhere.", "到处都是美丽的花。"], ["I like summer best because of Children's Day.", "我最喜欢夏天，因为有儿童节。"], ["What do you often do in summer?", "你夏天经常做什么？"], ["I often go swimming.", "我经常去游泳。"], ["Spring is green with flowers and songs.", "春天是绿色的，有花又有歌。"], ["Summer is hot and the days are long.", "夏天很热，白天很长。"], ["Autumn is golden and farmers are busy.", "秋天是金色的，农民很忙。"], ["Winter is white and the year is gone.", "冬天是白色的，一年过去了。"], ["I like autumn best.", "我最喜欢秋天。"], ["The colours are very pretty!", "颜色真漂亮！"], ["Because I like summer vacation!", "因为我喜欢暑假！"], ["I often go on a picnic with my family.", "我经常和家人去野餐。"], ["I often play in the snow.", "我经常在雪里玩。"], ["I like winter because I can play in the snow.", "我喜欢冬天，因为可以在雪里玩。"], ["Why do you like spring best?", "你为什么最喜欢春天？"], ["Because the weather is nice.", "因为天气很好。"]], "Unit 3": [["When is Tree Planting Day?", "植树节是什么时候？"], ["It's in March.", "在三月。"], ["When is Dragon Boat Festival?", "端午节是什么时候？"], ["It's usually in June.", "通常在六月。"], ["My mum will make zongzi then.", "到时候我妈妈会包粽子。"], ["When is the school trip this year?", "今年的春游是什么时候？"], ["It's in May.", "在五月。"], ["We have a few fun things in spring.", "春天我们有几件好玩的事。"], ["After the sports meet, we have an English party.", "运动会之后，我们有英语派对。"], ["When is the party?", "派对是什么时候？"], ["It's in April.", "在四月。"], ["When is Mother's Day?", "母亲节是什么时候？"], ["Teachers' Day is in September.", "教师节在九月。"], ["When is Teachers' Day?", "教师节是什么时候？"], ["It's in September.", "在九月。"], ["I'll make a card.", "我要做一张贺卡。"], ["I'll cook for my mother.", "我要为妈妈做饭。"], ["We'll go to the Great Wall.", "我们要去长城。"]], "Unit 4": [["When is Mother's Day?", "母亲节是什么时候？"], ["It's on the second Sunday in May.", "在五月的第二个星期日。"], ["What do you usually do on Mid-Autumn Day?", "中秋节你们通常做什么？"], ["We eat mooncakes.", "我们吃月饼。"], ["Happy birthday, Mum!", "妈妈，生日快乐！"], ["When is the art show?", "美术展是什么时候？"], ["It's on May 1st.", "在五月一日。"], ["When is the reading festival?", "阅读节是什么时候？"], ["It's on May 5th.", "在五月五日。"], ["When is China's National Day?", "中国的国庆节是什么时候？"], ["It's on October 1st.", "在十月一日。"], ["When is the English test?", "英语考试是什么时候？"], ["It's on November 2nd.", "在十一月二日。"], ["When is your birthday?", "你的生日是什么时候？"], ["My birthday is on April 4th.", "我的生日在四月四日。"], ["I'll cook noodles for her.", "我要为她煮面条。"], ["We can have a birthday party for both of you!", "我们可以为你们俩开生日派对！"], ["My birthday is on January 1st.", "我的生日在一月一日。"]], "Unit 5": [["What a beautiful painting!", "多美的画啊！"], ["The yellow picture is mine.", "那幅黄色的画是我的。"], ["Are these all ours?", "这些都是我们的吗？"], ["Yes, they are.", "是的，都是。"], ["That picture of Beijing is beautiful.", "那幅北京的画很美。"], ["Whose is it?", "它是谁的？"], ["It's Zhang Peng's.", "是张鹏的。"], ["Whose book is this?", "这是谁的书？"], ["Whose storybooks are these?", "这些故事书是谁的？"], ["The dog is yours.", "这只狗是你的。"], ["That's my dog!", "那是我的狗！"], ["The book is hers.", "这本书是她的。"], ["Where is Fido now?", "菲多现在在哪里？"], ["He's in the kitchen.", "他在厨房里。"], ["Is he drinking water?", "他在喝水吗？"], ["No, he isn't.", "不，他没有。"], ["Can I play with him now?", "我现在可以和他玩吗？"], ["They're playing with each other.", "他们在互相玩耍。"]], "Unit 6": [["Look at the pandas.", "看熊猫。"], ["What are they doing?", "他们在做什么？"], ["They're eating lunch!", "他们在吃午饭！"], ["They like bamboo.", "他们喜欢竹子。"], ["What's the little monkey doing?", "小猴子在做什么？"], ["It's playing with its mother!", "他在和妈妈玩！"], ["Do you see any elephants?", "你看见大象了吗？"], ["The elephant is drinking water.", "大象在喝水。"], ["We're having an English class.", "我们在上英语课。"], ["What's Chen Jie doing?", "陈洁在做什么？"], ["She's listening to music.", "她在听音乐。"], ["Quiet, please!", "请安静！"], ["Keep your desk clean!", "保持你的课桌整洁！"], ["Talk quietly, please.", "请小声说话。"], ["Keep to the right.", "靠右行。"], ["What are you doing?", "你在做什么？"], ["I'm drawing a picture.", "我在画画。"], ["Can you teach me?", "你能教我吗？"]]}, "g6a": {"Unit 1": [["Where is the science museum?", "科学博物馆在哪里？"], ["It's near the library.", "它在图书馆附近。"], ["How can I get there?", "我怎么去那里？"], ["Turn right at the school.", "在学校右转。"], ["Then go straight.", "然后直走。"], ["Where is the museum shop?", "博物馆商店在哪里？"], ["I want to buy a postcard.", "我想买一张明信片。"], ["Where is the post office?", "邮局在哪里？"], ["I want to send it today.", "我想今天把它寄出去。"], ["It's next to the museum.", "它在博物馆旁边。"], ["What a great museum!", "多棒的博物馆啊！"], ["Excuse me, sir.", "先生，打扰一下。"], ["Where is the cinema?", "电影院在哪里？"], ["It's next to the bookstore.", "它在书店旁边。"], ["There is a pet hospital in my city.", "我的城市里有一家宠物医院。"], ["Turn left at the bookstore.", "在书店左转。"], ["Then turn right at the hospital.", "然后在医院右转。"], ["Follow me, please!", "请跟我来！"]], "Unit 2": [["How do you go to school?", "你怎么去上学？"], ["I often go by subway.", "我经常坐地铁去。"], ["I usually come on foot.", "我通常步行来。"], ["How do you come to school?", "你怎么来学校？"], ["Usually, I come on foot.", "通常我步行来。"], ["Sometimes I come by bus.", "有时我坐公交车来。"], ["That's good exercise.", "那是很好的锻炼。"], ["How do we get there?", "我们怎么去那里？"], ["By bus.", "坐公交车。"], ["Don't go at the red light!", "红灯时不要走！"], ["You must pay attention to the traffic lights.", "你必须注意交通信号灯。"], ["Stop and wait at a red light.", "红灯时停下来等。"], ["Go at a green light.", "绿灯时走。"], ["Slow down and stop at a yellow light.", "黄灯时慢下来停下。"], ["In the USA people on bikes must wear one.", "在美国，骑自行车的人必须戴头盔。"], ["Oh, the bus is coming!", "哦，公交车来了！"], ["Some kids go to school by sled.", "有些孩子坐雪橇上学。"]], "Unit 3": [["What are you going to do tomorrow?", "你明天打算做什么？"], ["I'm going to have an art lesson.", "我要上美术课。"], ["We're going to draw some pictures in Renmin Park.", "我们要在人民公园画画。"], ["I'm going to see a film tomorrow.", "我明天要去看电影。"], ["Have a good time!", "玩得开心！"], ["I have to do my homework now.", "我现在必须做作业。"], ["What are you going to do today?", "你今天打算做什么？"], ["I'm going to see a film.", "我要去看电影。"], ["I'm going to visit my grandparents.", "我要去看望祖父母。"], ["My cousin Jack is going to visit me next week.", "我的表弟杰克下周要来看我。"], ["Where are you going?", "你们要去哪里？"], ["We're going to the cinema.", "我们要去电影院。"], ["We're going to see a film about space travel!", "我们要看一部关于太空旅行的电影！"], ["When are you going?", "你们什么时候去？"], ["Why not go on Tuesday?", "为什么不周二去呢？"], ["It's half price then!", "那天半价！"], ["I'm going to buy a new comic book.", "我要买一本新漫画书。"]], "Unit 4": [["What are Peter's hobbies?", "彼得的爱好是什么？"], ["He likes reading stories.", "他喜欢读故事。"], ["He lives on a farm.", "他住在农场。"], ["He also likes singing.", "他还喜欢唱歌。"], ["I'm going to teach him the Chinese song \"Jasmine Flower\"!", "我要教他中文歌《茉莉花》。"], ["What are your hobbies?", "你的爱好是什么？"], ["I like reading stories.", "我喜欢读故事。"], ["I also like singing and doing kung fu.", "我还喜欢唱歌和练功夫。"], ["I'm writing an email to my new pen pal in Australia.", "我在给我在澳大利亚的新笔友写邮件。"], ["Does he live in Sydney?", "他住在悉尼吗？"], ["No, he doesn't. He lives in Canberra.", "不，他住在堪培拉。"], ["Does he like doing word puzzles and going hiking?", "他喜欢玩字谜和去远足吗？"], ["Yes, he does.", "是的，他喜欢。"], ["Can I also be his pen pal?", "我也可以做他的笔友吗？"], ["Sure.", "当然可以。"], ["He lives in Australia, but he studies Chinese.", "他住在澳大利亚，但他学中文。"], ["What is your hobby?", "你的爱好是什么？"]], "Unit 5": [["What does your mother do, Oliver?", "奥利弗，你妈妈是做什么的？"], ["My father is a businessman.", "我爸爸是商人。"], ["She is a head teacher.", "她是校长。"], ["What does he do?", "他是做什么的？"], ["Is your father here today?", "你爸爸今天在这里吗？"], ["He's in Australia.", "他在澳大利亚。"], ["He often goes to other countries.", "他经常去其他国家。"], ["Do you want to be a head teacher too?", "你也想当校长吗？"], ["No, I want to be a businessman.", "不，我想当商人。"], ["Is your father a postman?", "你爸爸是邮递员吗？"], ["No, he isn't.", "不，他不是。"], ["Where does he work?", "他在哪里工作？"], ["He works at sea.", "他在海上工作。"], ["He sees lots of fish every day!", "他每天看到很多鱼！"], ["How does he go to work?", "他怎么去上班？"], ["He goes to work by bike.", "他骑自行车上班。"], ["We should study hard and stay healthy, too.", "我们也应该努力学习，保持健康。"]], "Unit 6": [["What's this cartoon about?", "这部动画片讲的是什么？"], ["It's about a cat.", "讲的是一只猫。"], ["The cat is a police officer.", "这只猫是警察。"], ["He chases the mice.", "他追老鼠。"], ["They're afraid of him.", "他们怕他。"], ["The cat is angry with them.", "猫对他们很生气。"], ["How do you feel?", "你感觉怎么样？"], ["Your father is ill.", "你爸爸病了。"], ["He should see a doctor this morning.", "他今天上午应该去看医生。"], ["Don't be sad.", "别难过。"], ["We can go next time.", "我们下次再去。"], ["Let's go to the hospital.", "我们去医院吧。"], ["What should I do?", "我该怎么办？"], ["You should do more exercise.", "你应该多锻炼。"], ["You should wear warm clothes.", "你应该穿暖和的衣服。"], ["You should take a deep breath and count to ten.", "你应该深呼吸，数到十。"], ["Don't be angry.", "别生气。"], ["Everyone is happy!", "大家都很开心！"]]}, "g6b": {"Unit 1": [["Some dinosaurs are bigger than houses.", "有些恐龙比房子还大。"], ["Some are smaller than our schoolbags.", "有些比我们的书包还小。"], ["That's the tallest dinosaur in this hall.", "那是这个大厅里最高的恐龙。"], ["How tall is it?", "它有多高？"], ["Maybe 4 metres.", "大概4米。"], ["It's taller than both of us together.", "它比我们俩加起来还高。"], ["There are more dinosaurs over there!", "那边有更多的恐龙！"], ["They're all so big and tall.", "他们都又大又高。"], ["I'm taller than this one.", "我比这只高。"], ["How tall are you?", "你有多高？"], ["I'm 1.6 metres tall.", "我身高1.6米。"], ["What size are your shoes?", "你的鞋子穿多大码？"], ["Your feet are bigger than mine.", "你的脚比我的大。"], ["You look taller than me.", "你看起来比我高。"], ["How heavy are you?", "你有多重？"], ["You're heavier than me.", "你比我重。"], ["The sun goes down every day, and we grow older every day.", "太阳每天落下，我们每天长大。"], ["Your shadow grows longer because you are growing taller.", "你的影子变长是因为你在长高。"]], "Unit 2": [["How was your weekend?", "你的周末过得怎么样？"], ["It was good, thank you.", "很好，谢谢。"], ["What did you do?", "你做什么了？"], ["I stayed at home with your grandma.", "我和你奶奶待在家里。"], ["We drank tea in the afternoon and watched TV.", "我们下午喝茶、看电视。"], ["Did you do anything else?", "你还做别的了吗？"], ["Yes, I cleaned my room and washed my clothes.", "做了，我打扫了房间，洗了衣服。"], ["You are a good boy!", "你真是个好孩子！"], ["What did you do last weekend?", "你上周末做什么了？"], ["Let's go to the bookstore.", "我们去书店吧。"], ["I want to buy the new film magazine.", "我想买新的电影杂志。"], ["Was it interesting?", "有趣吗？"], ["Yes, it talked about a lot of new films.", "有趣，讲了很多新电影。"], ["Did you see a film?", "你看电影了吗？"], ["No, I had a cold.", "没有，我感冒了。"], ["I stayed at home all weekend and slept.", "我整个周末待在家睡觉。"], ["I'm happy you feel better now.", "你现在好些了，我很高兴。"], ["It's faster than walking.", "这比走路快。"]], "Unit 3": [["What happened?", "发生什么了？"], ["I fell off my bike last Saturday and hurt my foot.", "我上周六从自行车上摔下来，弄伤了脚。"], ["That's too bad!", "太糟糕了！"], ["Are you all right?", "你还好吗？"], ["Yes, I'm OK.", "嗯，我没事。"], ["Come and look at my photos from the Labour Day holiday.", "来看看我劳动节假期的照片。"], ["I rode a horse.", "我骑了马。"], ["It looks like a mule!", "它看起来像骡子！"], ["We saw lots of grapes there, but we couldn't eat them.", "我们在那里看到很多葡萄，但不能吃。"], ["They won't be ready till August.", "它们到八月才会成熟。"], ["Where did you go over the winter holiday?", "你寒假去哪儿了？"], ["My family and I went to Sanya.", "我和家人去了三亚。"], ["Did you like it?", "你喜欢那里吗？"], ["Yes, it was so warm.", "喜欢，那里很暖和。"], ["How did you go there?", "你们怎么去的？"], ["We went there by plane.", "我们坐飞机去的。"], ["It was beautiful.", "那里很美。"], ["I took lots of pictures, and I also went swimming.", "我拍了很多照片，还去游泳了。"]], "Unit 4": [["Tell us about your school, please.", "请给我们讲讲您的学校。"], ["There was no library in my old school.", "我的老学校没有图书馆。"], ["There was only one small building on a hill.", "山上只有一座小建筑。"], ["Could you see stars at night?", "晚上能看到星星吗？"], ["Yes, I liked the stars.", "能，我喜欢星星。"], ["One day I'm going to visit the moon.", "总有一天我要去月球看看。"], ["There were no computers or Internet in my time.", "我那个年代没有电脑和互联网。"], ["There was no gym in my school twenty years ago.", "二十年前我的学校没有体育馆。"], ["Now there's a new one in our school.", "现在我们学校有一个新的。"], ["People didn't go by bus.", "人们不坐公交车出行。"], ["People couldn't use the Internet.", "人们不能用互联网。"], ["We are all different now!", "我们现在都不一样了！"], ["Before, I was quiet.", "以前我很安静。"], ["Now, I'm very active in class.", "现在我在课堂上很活跃。"], ["I couldn't run fast or play basketball well.", "我跑不快，篮球也打不好。"], ["There were many people there.", "那里有很多人。"], ["It was all a dream!", "这一切都是个梦！"], ["What a dream!", "多奇怪的梦啊！"]]}};
    function initTbSentPicker() {
        var bs = document.getElementById('tbSentBookSel');
        if (!bs) return;
        if (!bs.options.length) {
            var html = '';
            Object.keys(TEXTBOOK_SENTENCES).forEach(function(k) { if (TEXTBOOK_BOOKS[k]) html += '<option value="' + k + '">' + TEXTBOOK_BOOKS[k].title + '</option>'; });
            bs.innerHTML = html;
        }
        renderTbSentUnits();
    }
    function renderTbSentUnits() {
        var key = document.getElementById('tbSentBookSel').value;
        var units = TEXTBOOK_SENTENCES[key] || {};
        var html = '';
        Object.keys(units).forEach(function(u) { html += '<option value="' + u + '">' + u + '（' + units[u].length + '句）</option>'; });
        document.getElementById('tbSentUnitSel').innerHTML = html;
    }
    function importTextbookSentences() {
        var key = document.getElementById('tbSentBookSel').value;
        var unit = document.getElementById('tbSentUnitSel').value;
        var list = (TEXTBOOK_SENTENCES[key] || {})[unit] || [];
        if (!list.length) { alert('这个单元没有句子。'); return; }
        var cur = DiyStore.sents();
        var seen = {};
        cur.forEach(function(s) { seen[s.en] = 1; });
        var added = 0;
        list.forEach(function(pair) { if (!seen[pair[0]]) { seen[pair[0]] = 1; cur.push({ en: pair[0], zh: pair[1] }); added++; } });
        DiyStore.saveSents(cur);
        renderDiySents();
        alert('已导入 ' + added + ' 句（' + TEXTBOOK_BOOKS[key].title + ' ' + unit + '），句子库现有 ' + cur.length + ' 句。' + (added < list.length ? '其余是已有的，没有重复导入。' : ''));
    }
    var currentTextbook = null;
    function loadTextbook(key) {
        var b = TEXTBOOK_BOOKS[key];
        if (!b) return;
        currentTextbook = key;
        currentUnitIdx = null;
        unitBarOpen = true;
        renderUnitBar();
        parseCSVData(mergeUnitCSVs(b.units), b.title + '.csv');
    }
    function loadUnit(idx) {
        if (!currentTextbook) return;
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var u = b.units[idx];
        if (!u) return;
        currentUnitIdx = idx;
        renderPartRow();
        parseCSVData(u.csv, b.title + ' ' + u.name + '.csv');
        foldUnitBar();
    }
    function loadByPages() {
        if (!currentTextbook) return;
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var from = parseInt(document.getElementById('pageFrom').value, 10);
        var to = parseInt(document.getElementById('pageTo').value, 10);
        if (isNaN(from)) from = b.units[0].start;
        if (isNaN(to)) to = b.units[b.units.length - 1].end;
        if (from > to) { var tmp = from; from = to; to = tmp; }
        var hit = b.units.filter(function(u) { return u.start <= to && u.end >= from; });
        if (!hit.length) { alert('第 ' + from + '–' + to + ' 页没有对应的单元单词（这册课文页是第 ' + b.units[0].start + '–' + b.units[b.units.length - 1].end + ' 页）'); return; }
        parseCSVData(mergeUnitCSVs(hit), b.title + ' 第' + from + '–' + to + '页.csv');
        foldUnitBar();
    }
    function renderUnitBar() {
        var bar = document.getElementById('unitBar');
        if (!bar) return;
        if (!currentTextbook) { bar.innerHTML = ''; return; }
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var html = '<span class="textbook-label unit-toggle" onclick="toggleUnitBar()"><span id="unitTri">' + (unitBarOpen ? '▼' : '▶') + '</span> ' + b.title.replace('PEP ', '') + ' · 按单元背</span><div id="unitBody" style="display:' + (unitBarOpen ? 'contents' : 'none') + '">';
        html += '<button class="tb-btn unit-btn" onclick="loadTextbook(\'' + currentTextbook + '\')">整册<span class="tb-sub">' + bookCount(currentTextbook) + '词</span></button>';
        b.units.forEach(function(u, i) {
            var n = u.csv.split('\n').filter(function(x) { return x.trim(); }).length;
            var ca = u.parts && u.parts[0].csv ? u.parts[0].csv.split('\n').length : 0;
            var cb = u.parts && u.parts[1].csv ? u.parts[1].csv.split('\n').length : 0;
            html += '<button class="tb-btn unit-btn" onclick="loadUnit(' + i + ')">' + u.name + '<span class="tb-sub">第' + u.start + '–' + u.end + '页 · ' + n + '词（A ' + ca + ' · B ' + cb + '）</span></button>';
        });
        html += '<div class="page-row"><span>按页数背：第</span><input type="number" id="pageFrom" class="page-input" min="1" placeholder="' + b.units[0].start + '"><span>页到第</span><input type="number" id="pageTo" class="page-input" min="1" placeholder="' + b.units[b.units.length - 1].end + '"><span>页</span><button class="btn btn-primary page-go" onclick="loadByPages()">按页数背</button></div>';
        html += '<div class="part-row" id="partRow"></div></div>';
        bar.innerHTML = html;
        renderPartRow();
    }
    var currentUnitIdx = null;
    function renderPartRow() {
        var row = document.getElementById('partRow');
        if (!row) return;
        if (currentUnitIdx === null || !currentTextbook || !TEXTBOOK_BOOKS[currentTextbook]) { row.innerHTML = ''; return; }
        var u = TEXTBOOK_BOOKS[currentTextbook].units[currentUnitIdx];
        if (!u || !u.parts) { row.innerHTML = ''; return; }
        var ca = u.parts[0].csv ? u.parts[0].csv.split('\n').length : 0;
        var cb = u.parts[1].csv ? u.parts[1].csv.split('\n').length : 0;
        row.innerHTML = '<span>' + u.name + ' 分课时：</span>' +
            '<button class="btn btn-secondary" onclick="loadUnit(' + currentUnitIdx + ')">整单元</button>' +
            '<button class="btn btn-primary" onclick="loadUnitPart(0)">Part A（' + ca + '词）</button>' +
            '<button class="btn btn-primary" onclick="loadUnitPart(1)">Part B（' + cb + '词）</button>';
    }
    function loadUnitPart(p) {
        if (!currentTextbook || currentUnitIdx === null) return;
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var u = b.units[currentUnitIdx];
        if (!u || !u.parts) return;
        parseCSVData(u.parts[p].csv, b.title + ' ' + u.name + ' ' + u.parts[p].name + '.csv');
        foldUnitBar();
    }
    // --- DIY mode: parent-picked words + custom sentences ---
    var DiyStore = {
        WKEY: 'word_spelling_diy_words',
        SKEY: 'word_spelling_diy_sentences',
        words: function() { try { return JSON.parse(localStorage.getItem(this.WKEY)) || []; } catch (e) { return []; } },
        saveWords: function(w) { try { localStorage.setItem(this.WKEY, JSON.stringify(w)); } catch (e) {} },
        sents: function() { try { return JSON.parse(localStorage.getItem(this.SKEY)) || []; } catch (e) { return []; } },
        saveSents: function(x) { try { localStorage.setItem(this.SKEY, JSON.stringify(x)); } catch (e) {} }
    };
    function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function openDiyModal() { initCollapsibleSections(); initSchoolPicker(); initDiyPicker(); renderDiyWords(); renderMyWords(); initTbSentPicker(); renderDiySents(); document.getElementById('diyModal').style.display = 'flex'; }
    function closeDiyModal() { document.getElementById('diyModal').style.display = 'none'; }
    var diyLastBook = null;
    function initDiyPicker() {
        var bs = document.getElementById('diyBookSel');
        if (!bs.options.length) {
        var html = '';
        TEXTBOOK_STAGES.forEach(function(g) { g.books.forEach(function(it) { if (TEXTBOOK_BOOKS[it.key]) html += '<option value="' + it.key + '">' + TEXTBOOK_BOOKS[it.key].title + '</option>'; }); });
        bs.innerHTML = html;
        }
        renderPicker();
    }
    function renderUnitSel() {
        var key = document.getElementById('diyBookSel').value;
        var b = TEXTBOOK_BOOKS[key];
        var html = '<option value="-1">整册</option>';
        b.units.forEach(function(u, i) {
            html += '<option value="' + i + '">' + u.name + '（第' + u.start + '–' + u.end + '页）</option>';
            html += '<option value="' + i + ':0">' + u.name + ' · Part A</option>';
            html += '<option value="' + i + ':1">' + u.name + ' · Part B</option>';
        });
        document.getElementById('diyUnitSel').innerHTML = html;
    }
    function renderPicker() {
        var key = document.getElementById('diyBookSel').value;
        if (key !== diyLastBook) { diyLastBook = key; renderUnitSel(); }
        var b = TEXTBOOK_BOOKS[key];
        var sel = document.getElementById('diyUnitSel').value;
        var csv;
        if (sel === '-1') csv = mergeUnitCSVs(b.units);
        else if (sel.indexOf(':') >= 0) { var pp = sel.split(':'); csv = b.units[parseInt(pp[0], 10)].parts[parseInt(pp[1], 10)].csv; }
        else csv = b.units[parseInt(sel, 10)].csv;
        var html = '';
        csv.split('\n').forEach(function(line) {
        line = line.trim(); if (!line) return;
        var idx = line.indexOf(',');
        var en = line.slice(0, idx).trim(), zh = line.slice(idx + 1).trim();
        html += '<label class="pick-item"><input type="checkbox" class="pick-check" value="' + escHtml(en) + '" data-zh="' + escHtml(zh) + '"><span class="en">' + escHtml(en) + '</span><span class="zh">' + escHtml(zh) + '</span></label>';
        });
        document.getElementById('pickList').innerHTML = html || '<p style="color:#888;padding:8px;">这个范围没有单词。</p>';
    }
    function pickerSelectAll(on) { var cs = document.querySelectorAll('.pick-check'); for (var i = 0; i < cs.length; i++) cs[i].checked = on; }
    function addPickedToDiy() {
        var cs = document.querySelectorAll('.pick-check');
        var list = DiyStore.words();
        var seen = {}; list.forEach(function(w) { seen[w.en.toLowerCase()] = 1; });
        var added = 0;
        for (var i = 0; i < cs.length; i++) { if (!cs[i].checked) continue; var en = cs[i].value; if (seen[en.toLowerCase()]) continue; seen[en.toLowerCase()] = 1; list.push({ en: en, zh: cs[i].getAttribute('data-zh') || '' }); added++; }
        DiyStore.saveWords(list);
        renderDiyWords();
        alert(added ? '已加入 ' + added + ' 个词，DIY词单现有 ' + list.length + ' 个词。' : '没有新词加入（没勾选，或已经在词单里了）。');
    }
    function renderDiyWords() {
        var list = DiyStore.words();
        var box = document.getElementById('diyWordsBox');
        if (!list.length) { box.innerHTML = '<p style="color:#888;">DIY词单还是空的，在上面勾选单词加入。</p>'; return; }
        var html = '<p style="margin:6px 0;"><strong>DIY词单（' + list.length + ' 词）</strong></p><div>';
        list.forEach(function(w, i) { html += '<span class="diy-chip">' + escHtml(w.en) + '<button onclick="removeDiyWord(' + i + ')">✕</button></span>'; });
        html += '</div><div style="margin-top:8px;"><button class="btn btn-primary" onclick="startDiyWords()">▶️ 开始背DIY词单</button> <button class="btn btn-secondary" onclick="clearDiyWords()">清空词单</button></div>';
        box.innerHTML = html;
    }
    function removeDiyWord(i) { var list = DiyStore.words(); list.splice(i, 1); DiyStore.saveWords(list); renderDiyWords(); }
    function clearDiyWords() { DiyStore.saveWords([]); renderDiyWords(); }
    function startDiyWords() {
        var list = DiyStore.words();
        if (!list.length) return;
        var csv = list.map(function(w) { return w.en + ',' + w.zh; }).join('\n');
        closeDiyModal();
        parseCSVData(csv, 'DIY词单.csv');
    }
    function addSentences() {
        var ta = document.getElementById('diySentInput');
        var lines = ta.value.split('\n');
        var list = DiyStore.sents();
        var added = 0;
        lines.forEach(function(line) {
        line = line.trim(); if (!line) return;
        var parts = line.split('|');
        if (parts.length < 2 && line.indexOf('｜') >= 0) parts = line.split('｜');
        var en = (parts[0] || '').trim();
        var zh = (parts[1] || '').trim();
        if (!en) return;
        list.push({ en: en, zh: zh });
        added++;
        });
        DiyStore.saveSents(list);
        ta.value = '';
        renderDiySents();
        if (!added) alert('没有读到句子：每行一句，格式是 英文|中文。');
    }
    function renderDiySents() {
        var list = DiyStore.sents();
        var box = document.getElementById('diySentBox');
        if (!list.length) { box.innerHTML = '<p style="color:#888;">句子单还是空的，在上面输入句子加入。</p>'; return; }
        var html = '<p style="margin:6px 0;"><strong>句子单（' + list.length + ' 句）</strong></p>';
        list.forEach(function(s, i) { html += '<div class="sent-item"><span>' + escHtml(s.en) + (s.zh ? ' <span style="color:#888;">' + escHtml(s.zh) + '</span>' : '') + '</span><button onclick="removeSentence(' + i + ')">✕ 删除</button></div>'; });
        html += '<div style="margin-top:8px;"><button class="btn btn-primary" onclick="startSentences()">▶️ 开始背句子</button> <button class="btn btn-secondary" onclick="clearSentences()">清空句子单</button></div>';
        box.innerHTML = html;
    }
    function removeSentence(i) { var list = DiyStore.sents(); list.splice(i, 1); DiyStore.saveSents(list); renderDiySents(); }
    function clearSentences() { DiyStore.saveSents([]); renderDiySents(); }
    function normalizeSentence(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function startSentences() {
        var list = DiyStore.sents();
        if (!list.length) return;
        closeDiyModal();
        var html = '';
        list.forEach(function(s, i) {
        html += '<div class="word-item sent-card" data-sent="' + i + '">'
            + '<div class="sent-zh">' + (s.zh ? escHtml(s.zh) : '✍️ 把这个句子拼出来') + '</div>'
            + '<div><button style="background:#1CB0F6;color:#fff;border:none;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer;" onclick="playSound(\'' + escHtml(s.en).replace(/'/g, "\\'") + '\')">🔊 听发音</button> '
            + '<button class="btn btn-secondary" onclick="peekSentence(this)">👀 看英文</button></div>'
            + '<div class="sent-answer" style="display:none; color:#46A302; font-weight:700; margin-top:6px;">' + escHtml(s.en) + '</div>'
            + '<input type="text" class="sent-input" placeholder="把这个句子打出来…" autocomplete="off">'
            + '<div><button class="btn btn-primary" onclick="checkSentence(this)">✔ 检查</button> <span class="sent-feedback" style="font-weight:700;"></span></div>'
            + '</div>';
        });
        document.getElementById('wordList').innerHTML = html;
        var st = document.getElementById('fileStatus'); if (st) st.innerText = '已加载: DIY句子单 (' + list.length + '个句子)';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function peekSentence(btn) {
        var card = btn.closest('.sent-card');
        var ans = card.querySelector('.sent-answer');
        ans.style.display = ans.style.display === 'none' ? 'block' : 'none';
    }
    function checkSentence(btn) {
        var card = btn.closest('.sent-card');
        var idx = parseInt(card.getAttribute('data-sent'), 10);
        var s = DiyStore.sents()[idx];
        if (!s) return;
        var input = card.querySelector('.sent-input');
        var fb = card.querySelector('.sent-feedback');
        var ok = input.value.trim().length > 0 && normalizeSentence(input.value) === normalizeSentence(s.en);
        if (ok) {
        if (!card.dataset.solved) {
            if (typeof TrialGate !== 'undefined' && !TrialGate.allow(s.en)) { showTrialLock(); return; }
            card.dataset.solved = '1';
            WordStats.update(s.en, true);
            if (typeof playCorrectSound === 'function') playCorrectSound();
        }
        fb.innerText = '✅ 答对了！'; fb.style.color = '#46A302';
        input.style.borderColor = '#58CC02';
        } else {
        if (!card.dataset.failed) {
            if (typeof TrialGate !== 'undefined' && !TrialGate.allow(s.en)) { showTrialLock(); return; }
            card.dataset.failed = '1';
            WordStats.update(s.en, false);
        }
        fb.innerText = '❌ 再想想，可以点🔊多听几遍'; fb.style.color = '#FF4B4B';
        input.style.borderColor = '#FF4B4B';
        }
    }
    // --- School progress: follow the school curriculum ---
    var SchoolStore = {
        KEY: 'word_spelling_school',
        get: function() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch (e) { return null; } },
        set: function(v) { try { localStorage.setItem(this.KEY, JSON.stringify(v)); } catch (e) {} }
    };
    function mergeCSVStrings(list) {
        var seen = {}, out = [];
        list.forEach(function(csv) {
            csv.split('\n').forEach(function(line) {
                line = line.trim(); if (!line) return;
                var k = line.split(',')[0].trim().toLowerCase();
                if (seen[k]) return;
                seen[k] = 1; out.push(line);
            });
        });
        return out.join('\n');
    }
    function schoolUnits() {
        var p = SchoolStore.get();
        if (!p || !TEXTBOOK_BOOKS[p.book]) return null;
        var b = TEXTBOOK_BOOKS[p.book];
        var last = Math.min(p.unit, b.units.length - 1);
        var part = (p.part === 0) ? 0 : 1;
        var csvList = [];
        for (var i = 0; i < last; i++) csvList.push(b.units[i].csv);
        csvList.push(part === 1 ? b.units[last].csv : b.units[last].parts[0].csv);
        return { book: p.book, title: b.title, last: last, part: part, units: b.units.slice(0, last + 1), csvList: csvList };
    }
    function renderSchoolBar() {
        var bar = document.getElementById('schoolBar');
        if (!bar) return;
        var sc = schoolUnits();
        if (!sc) {
        bar.innerHTML = '<span class="sb-title">🏫 学校进度</span><span>还没设置，设置后可一键背学校学过的内容</span><button class="btn btn-primary" onclick="openDiyModal()">去设置</button>';
        return;
        }
        var n = mergeCSVStrings(sc.csvList).split('\n').length;
        var where = '学到 ' + TEXTBOOK_BOOKS[sc.book].units[sc.last].name + (sc.part === 0 ? ' · Part A' : '');
        var btn = sc.part === 0 ? '▶️ 背学过的内容（到 Unit ' + (sc.last + 1) + ' Part A · ' + n + '词）' : '▶️ 背学过的内容（Unit 1–' + (sc.last + 1) + ' · ' + n + '词）';
        bar.innerHTML = '<span class="sb-title">🏫 学校进度：' + sc.title.replace('PEP ', '') + ' · ' + where + '</span><button class="btn btn-primary" onclick="loadSchoolWords()">' + btn + '</button>';
    }
    function loadSchoolWords() {
        var sc = schoolUnits();
        if (!sc) { openDiyModal(); return; }
        closeDiyModal();
        currentTextbook = sc.book;
        renderUnitBar();
        parseCSVData(mergeCSVStrings(sc.csvList), sc.title + ' 学校进度（Unit 1–' + (sc.last + 1) + (sc.part === 0 ? ' Part A' : '') + '）.csv');
    }
    function addSchoolWordsToDiy() {
        var sc = schoolUnits();
        if (!sc) { alert('先在上面选好课本和学到的单元，点「保存进度」。'); return; }
        var list = DiyStore.words();
        var seen = {}; list.forEach(function(w) { seen[w.en.toLowerCase()] = 1; });
        var added = 0;
        mergeCSVStrings(sc.csvList).split('\n').forEach(function(line) {
        line = line.trim(); if (!line) return;
        var idx = line.indexOf(',');
        var en = line.slice(0, idx).trim(), zh = line.slice(idx + 1).trim();
        if (seen[en.toLowerCase()]) return;
        seen[en.toLowerCase()] = 1;
        list.push({ en: en, zh: zh });
        added++;
        });
        DiyStore.saveWords(list);
        renderDiyWords();
        alert('已把学校进度内的词加入DIY词单（新增 ' + added + ' 个，词单现有 ' + list.length + ' 个）。');
    }
    function initSchoolPicker() {
        var bs = document.getElementById('schoolBookSel');
        if (!bs.options.length) {
        var html = '';
        TEXTBOOK_STAGES.forEach(function(g) { g.books.forEach(function(it) { if (TEXTBOOK_BOOKS[it.key]) html += '<option value="' + it.key + '">' + TEXTBOOK_BOOKS[it.key].title + '</option>'; }); });
        bs.innerHTML = html;
        var p = SchoolStore.get();
        if (p && TEXTBOOK_BOOKS[p.book]) bs.value = p.book;
        }
        renderSchoolUnitSel();
        var ps = document.getElementById('schoolPartSel');
        var sp = SchoolStore.get();
        if (ps) ps.value = sp && sp.part === 0 ? '0' : '1';
    }
    function renderSchoolUnitSel() {
        var key = document.getElementById('schoolBookSel').value;
        var b = TEXTBOOK_BOOKS[key];
        var html = '';
        b.units.forEach(function(u, i) { html += '<option value="' + i + '">学到 ' + u.name + '（第' + u.start + '–' + u.end + '页）</option>'; });
        var sel = document.getElementById('schoolUnitSel');
        sel.innerHTML = html;
        var p = SchoolStore.get();
        if (p && p.book === key) sel.value = String(Math.min(p.unit, b.units.length - 1));
    }
    function saveSchoolProgress() {
        var book = document.getElementById('schoolBookSel').value;
        var unit = parseInt(document.getElementById('schoolUnitSel').value, 10) || 0;
        var part = parseInt(document.getElementById('schoolPartSel').value, 10);
        if (isNaN(part)) part = 1;
        SchoolStore.set({ book: book, unit: unit, part: part });
        renderSchoolBar();
        alert('学校进度已保存：' + TEXTBOOK_BOOKS[book].title + ' · 学到 ' + TEXTBOOK_BOOKS[book].units[unit].name + (part === 0 ? ' · Part A' : '（整个单元）') + '。');
    }
    // --- My word library: user-added words ---
    var MyWords = {
        KEY: 'word_spelling_my_words',
        all: function() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
        save: function(w) { try { localStorage.setItem(this.KEY, JSON.stringify(w)); } catch (e) {} }
    };
    function pushMyWord(list, en, zh) {
        en = (en || '').trim(); zh = (zh || '').trim();
        if (!en) return false;
        for (var i = 0; i < list.length; i++) if (list[i].en.toLowerCase() === en.toLowerCase()) return false;
        list.push({ en: en, zh: zh });
        return true;
    }
    function addMyWord() {
        var enEl = document.getElementById('myWordEn');
        var zhEl = document.getElementById('myWordZh');
        var list = MyWords.all();
        if (!pushMyWord(list, enEl.value, zhEl.value)) { alert('没加上：英文是空的，或者这个词已经在单词库里了。'); return; }
        MyWords.save(list);
        enEl.value = ''; zhEl.value = '';
        renderMyWords();
        enEl.focus();
    }
    function importMyWords() {
        var ta = document.getElementById('myWordBulk');
        var list = MyWords.all();
        var added = 0;
        ta.value.split('\n').forEach(function(line) {
        line = line.trim(); if (!line) return;
        var parts = line.split(/[|,，\t]/);
        if (pushMyWord(list, parts[0], parts[1] || '')) added++;
        });
        MyWords.save(list);
        ta.value = '';
        renderMyWords();
        alert(added ? '已导入 ' + added + ' 个词，单词库现有 ' + list.length + ' 个词。' : '没有新词导入（格式不对或已经有了）。');
    }
    function renderMyWords() {
        var list = MyWords.all();
        var box = document.getElementById('myWordsBox');
        if (!box) return;
        if (!list.length) { box.innerHTML = '<p style="color:#888;">单词库还是空的，在上面添加自己的单词。</p>'; return; }
        var html = '<p style="margin:6px 0;"><strong>我的单词库（' + list.length + ' 词）</strong></p><div>';
        list.forEach(function(w, i) { html += '<span class="diy-chip">' + escHtml(w.en) + (w.zh ? ' ' + escHtml(w.zh) : '') + '<button onclick="removeMyWord(' + i + ')">✕</button></span>'; });
        html += '</div><div style="margin-top:8px;"><button class="btn btn-primary" onclick="startMyWords()">▶️ 背我的单词库</button> <button class="btn btn-secondary" onclick="clearMyWords()">清空单词库</button></div>';
        box.innerHTML = html;
    }
    function removeMyWord(i) { var list = MyWords.all(); list.splice(i, 1); MyWords.save(list); renderMyWords(); }
    function clearMyWords() { MyWords.save([]); renderMyWords(); }
    function startMyWords() {
        var list = MyWords.all();
        if (!list.length) return;
        var csv = list.map(function(w) { return w.en + ',' + w.zh; }).join('\n');
        closeDiyModal();
        parseCSVData(csv, '我的单词库.csv');
    }
    // --- Examples (cloze), graduated hints, reverse mode, streak ---
    var EXAMPLES = {"old": ["My grandpa is old, but he is strong.", "我爷爷年纪大了，但身体很壮。"], "young": ["The young teacher likes singing.", "这位年轻的老师喜欢唱歌。"], "funny": ["The clown is very funny.", "这个小丑非常滑稽。"], "kind": ["Our teacher is kind to everyone.", "我们的老师对每个人都很体贴。"], "strict": ["Mr Li is strict, but we like him.", "李老师很严格，但我们喜欢他。"], "polite": ["Be polite and say thank you.", "要有礼貌，要说谢谢。"], "hard-working": ["My mother is hard-working.", "我妈妈工作很勤奋。"], "helpful": ["The map is helpful for our trip.", "这张地图对我们的旅行很有用。"], "clever": ["The clever boy can answer it.", "这个聪明的男孩能回答出来。"], "shy": ["The new girl is a little shy.", "新来的女孩有点害羞。"], "know": ["I know the answer.", "我知道答案。"], "our": ["This is our classroom.", "这是我们的教室。"], "ms": ["Ms Wang is our English teacher.", "王女士是我们的英语老师。"], "will": ["We will go to the park tomorrow.", "我们明天会去公园。"], "sometimes": ["Sometimes I read books at home.", "有时我在家看书。"], "robot": ["The robot can talk and walk.", "这个机器人会说话还会走路。"], "him": ["I know him. He is my friend.", "我认识他，他是我的朋友。"], "speak": ["Can you speak English?", "你会说英语吗？"], "finish": ["Finish your homework first.", "先完成你的作业。"], "monday": ["We have English on Monday.", "我们星期一有英语课。"], "tuesday": ["Tuesday is my busy day.", "星期二是我忙碌的一天。"], "wednesday": ["We play football on Wednesday.", "我们星期三踢足球。"], "thursday": ["Thursday comes after Wednesday.", "星期四在星期三之后。"], "friday": ["I love Friday. The weekend is near.", "我喜欢星期五，周末快到了。"], "saturday": ["We go to the park on Saturday.", "我们星期六去公园。"], "sunday": ["Sunday is the first day of the week.", "星期日是一周的第一天。"], "weekend": ["What do you do on the weekend?", "你周末做什么？"], "wash": ["Wash your hands before dinner.", "晚饭前要洗手。"], "wash my clothes": ["I wash my clothes on Sunday.", "我星期日洗我的衣服。"], "watch": ["Watch the bird in the tree.", "看树上的那只鸟。"], "watch tv": ["I watch TV in the evening.", "我晚上看电视。"], "do": ["What do you do on Sundays?", "你星期日做什么？"], "do homework": ["I do homework after school.", "我放学后做作业。"], "read": ["I read a story every night.", "我每天晚上读一个故事。"], "read books": ["She likes to read books.", "她喜欢看书。"], "play": ["Let's play together after class.", "我们下课后一起玩吧。"], "play football": ["They play football on the playground.", "他们在操场上踢足球。"], "cooking": ["My mum is cooking in the kitchen.", "我妈妈正在厨房里烹饪。"], "often": ["I often help my mother.", "我常常帮助妈妈。"], "park": ["There is a big park near my home.", "我家附近有一个大公园。"], "tired": ["I am tired after running.", "跑步后我累了。"], "sport": ["Sport makes us healthy.", "体育运动让我们健康。"], "play sports": ["We play sports every day.", "我们每天做体育运动。"], "should": ["You should eat more vegetables.", "你应该多吃蔬菜。"], "every": ["Every student has a book.", "每个学生都有一本书。"], "day": ["Have a nice day!", "祝你有美好的一天！"], "schedule": ["This is my schedule for today.", "这是我今天的日程安排。"], "sandwich": ["I eat a sandwich for breakfast.", "我早餐吃一个三明治。"], "salad": ["The salad is fresh and delicious.", "这份沙拉新鲜又美味。"], "hamburger": ["He wants a hamburger and some juice.", "他想要一个汉堡包和一些果汁。"], "ice cream": ["Ice cream is sweet and cold.", "冰淇淋又甜又凉。"], "tea": ["My grandpa drinks tea every day.", "我爷爷每天喝茶。"], "fresh": ["The apples are fresh.", "这些苹果很新鲜。"], "healthy": ["Milk is healthy for children.", "牛奶对孩子健康有益。"], "delicious": ["The cake is delicious.", "这个蛋糕很美味。"], "hot": ["The soup is too hot for me.", "这汤对我来说太辣了。"], "sweet": ["The candy is sweet.", "这颗糖很甜。"], "drink": ["Drink some water, please.", "请喝点水。"], "thirsty": ["I am thirsty after PE class.", "体育课后我渴了。"], "favourite": ["Apples are my favourite fruit.", "苹果是我最喜欢的水果。"], "food": ["Chinese food is delicious.", "中国食物很美味。"], "dear": ["Dear Lucy, how are you?", "亲爱的露西，你好吗？"], "onion": ["I don't like onion.", "我不喜欢洋葱。"], "sing": ["She can sing very well.", "她唱歌唱得很好。"], "song": ["This song is my favourite.", "这首歌是我的最爱。"], "sing english songs": ["We sing English songs in class.", "我们在课上唱英文歌曲。"], "play the pipa": ["My sister can play the pipa.", "我姐姐会弹琵琶。"], "kung fu": ["Kung fu is from China.", "功夫来自中国。"], "do kung fu": ["The boy can do kung fu.", "这个男孩会练功夫。"], "dance": ["They dance at the party.", "他们在聚会上跳舞。"], "draw": ["I draw a picture of my family.", "我画了一幅全家福。"], "cartoon": ["This cartoon is very funny.", "这部漫画非常有趣。"], "draw cartoons": ["He likes to draw cartoons.", "他喜欢画漫画。"], "cook": ["Dad can cook yummy food.", "爸爸会烹调美味的食物。"], "swim": ["Fish can swim in the water.", "鱼能在水里游泳。"], "play basketball": ["We play basketball after school.", "我们放学后打篮球。"], "ping-pong": ["Ping-pong is popular in China.", "乒乓球在中国很受欢迎。"], "play ping-pong": ["Let's play ping-pong.", "我们打乒乓球吧。"], "speak english": ["We speak English in class.", "我们在课上说英语。"], "we'll": ["We'll have a party next week.", "我们下周将开一个聚会。"], "party": ["Welcome to my birthday party!", "欢迎来到我的生日聚会！"], "next": ["The next bus is at nine.", "下一班公交车是九点的。"], "wonderful": ["What a wonderful day!", "多么美好的一天啊！"], "learn": ["We learn English at school.", "我们在学校学英语。"], "any": ["Do you have any questions?", "你有什么问题吗？"], "problem": ["No problem, I can help you.", "没问题，我可以帮你。"], "no problem": ["No problem! It's easy.", "没问题！这很简单。"], "want": ["I want a new bike.", "我想要一辆新自行车。"], "send": ["Send me a postcard, please.", "请给我寄一张明信片。"], "email": ["I get an email from my pen pal.", "我收到笔友的一封电子邮件。"], "at": ["My email is lucy at qq dot com.", "我的邮箱是 lucy at qq dot com。"], "clock": ["The clock on the wall says eight.", "墙上的时钟显示八点。"], "plant": ["Water the plant every day.", "每天给植物浇水。"], "bottle": ["The bottle is full of water.", "这个瓶子装满了水。"], "water bottle": ["Take your water bottle to school.", "把你的水瓶带去学校。"], "bike": ["I go to school by bike.", "我骑自行车去上学。"], "photo": ["This photo is of my family.", "这张照片是我的全家福。"], "front": ["The front of the house is white.", "房子的正面是白色的。"], "in front of": ["The dog is in front of the door.", "狗在门前面。"], "between": ["The school is between the park and the shop.", "学校在公园和商店中间。"], "above": ["The picture is above the desk.", "画在书桌上方。"], "beside": ["Sit beside me, please.", "请坐在我旁边。"], "behind": ["The cat is behind the box.", "猫在盒子后面。"], "there": ["There is a lake in the park.", "公园里有一个湖。"], "grandfather": ["My grandfather lives in the village.", "我爷爷住在村庄里。"], "their": ["Their house is big and clean.", "他们的房子又大又干净。"], "house": ["The house has a small garden.", "这栋房子有一个小花园。"], "lot": ["A lot of people are in the park.", "公园里有许多人。"], "lots of": ["There are lots of flowers here.", "这里有大量的花。"], "flower": ["The flower is pink and lovely.", "这朵花粉粉的，很可爱。"], "move": ["We will move to a new house.", "我们将搬到新家。"], "dirty": ["Your shoes are dirty.", "你的鞋子脏了。"], "everywhere": ["Books are everywhere in his room.", "他的房间里到处都是书。"], "mouse": ["A mouse is under the desk.", "一只老鼠在书桌下面。"], "live": ["We live in Xiamen.", "我们住在厦门。"], "nature": ["Nature is beautiful in spring.", "春天的自然界很美。"], "forest": ["Many animals live in the forest.", "许多动物住在森林里。"], "river": ["The river is long and wide.", "这条河又长又宽。"], "lake": ["We go boating on the lake.", "我们在湖上划船。"], "mountain": ["The mountain is very high.", "这座山很高。"], "hill": ["There are trees on the hill.", "小山上有树。"], "tree": ["The tree is tall and green.", "这棵树又高又绿。"], "bridge": ["We walk over the bridge.", "我们走过这座桥。"], "building": ["That building is our school.", "那栋建筑物是我们的学校。"], "village": ["My grandparents live in a village.", "我的祖辈住在一个村庄里。"], "boating": ["Boating is fun in summer.", "夏天划船很有趣。"], "go boating": ["Let's go boating this weekend.", "我们这个周末去划船吧。"], "aren't": ["They aren't at home today.", "他们今天不在家。"], "rabbit": ["The rabbit has long ears.", "兔子有长长的耳朵。"], "high": ["The kite flies high.", "风筝飞得很高。"], "eat breakfast": ["I eat breakfast at seven.", "我七点吃早饭。"], "have...class": ["We have an English class today.", "我们今天有一节英语课。"], "exercise": ["Exercise is good for us.", "运动对我们有好处。"], "do morning exercises": ["We do morning exercises at school.", "我们在学校做早操。"], "eat dinner": ["We eat dinner together at home.", "我们在家一起吃晚饭。"], "clean my room": ["I clean my room on Saturday.", "我星期六打扫我的房间。"], "go for a walk": ["Grandpa likes to go for a walk.", "爷爷喜欢去散步。"], "go shopping": ["Mum and I go shopping on Sunday.", "妈妈和我星期日去购物。"], "take": ["I take a dancing class on Friday.", "我星期五上舞蹈课。"], "dancing": ["Dancing is her hobby.", "跳舞是她的爱好。"], "take a dancing class": ["I take a dancing class every week.", "我每周上舞蹈课。"], "when": ["When do you get up?", "你什么时候起床？"], "after": ["We play after school.", "我们放学后玩耍。"], "start": ["Class starts at eight.", "八点开始上课。"], "usually": ["I usually get up at six.", "我通常六点起床。"], "spain": ["Spain is a country in Europe.", "西班牙是欧洲的一个国家。"], "late": ["Don't be late for school.", "上学不要迟到。"], "a.m.": ["I get up at 6:30 a.m.", "我早上6:30起床。"], "p.m.": ["We go home at 4:30 p.m.", "我们下午4:30回家。"], "why": ["Why are you happy today?", "你今天为什么开心？"], "shop": ["I shop with my mother.", "我和妈妈一起去买东西。"], "work": ["My father goes to work by bus.", "我爸爸坐公交车去工作。"], "last": ["Last weekend we went to the park.", "上一个周末我们去了公园。"], "sound": ["That sounds like a good idea.", "那听起来像个好主意。"], "also": ["I also like apples.", "我也喜欢苹果。"], "busy": ["Mum is busy in the kitchen.", "妈妈在厨房里忙碌。"], "need": ["I need a new pen.", "我需要一支新钢笔。"], "letter": ["I write a letter to my friend.", "我给朋友写一封信。"], "island": ["The island is in the sea.", "这座岛在海里。"], "always": ["He always helps others.", "他总是帮助别人。"], "cave": ["The cave is dark and cool.", "这个山洞又黑又凉。"], "go swimming": ["We go swimming in summer.", "我们夏天去游泳。"], "win": ["Our team will win the game.", "我们队会赢得比赛。"], "spring": ["Spring is warm and green.", "春天温暖又翠绿。"], "summer": ["Summer is hot and sunny.", "夏天炎热又晴朗。"], "autumn": ["Autumn is cool and golden.", "秋天凉爽又金黄。"], "winter": ["Winter is cold and white.", "冬天寒冷又雪白。"], "season": ["There are four seasons in a year.", "一年有四个季节。"], "picnic": ["We have a picnic in the park.", "我们在公园里野餐。"], "go on a picnic": ["Let's go on a picnic tomorrow.", "我们明天去野餐吧。"], "pick": ["Pick the red apple, please.", "请摘那个红苹果。"], "pick apples": ["We pick apples on the farm.", "我们在农场摘苹果。"], "snowman": ["The snowman has a carrot nose.", "雪人有一个胡萝卜鼻子。"], "make a snowman": ["Children make a snowman in winter.", "孩子们在冬天堆雪人。"], "which": ["Which season do you like best?", "你最喜欢哪一个季节？"], "best": ["I like spring best.", "我最喜欢春天。"], "snow": ["Snow is white and soft.", "雪是白色的，很柔软。"], "good job": ["Good job! You did it well.", "做得好！你做得很好。"], "because": ["I like summer because I can swim.", "我喜欢夏天，因为我可以游泳。"], "vacation": ["We travel on vacation.", "我们假期去旅行。"], "all": ["All the children are happy.", "所有的孩子都很开心。"], "pink": ["The flowers are pink.", "这些花是粉色的。"], "lovely": ["The kitten is so lovely.", "这只小猫太可爱了。"], "leaf": ["A leaf falls from the tree.", "一片叶子从树上落下。"], "fall": ["Leaves fall in autumn.", "树叶在秋天落下。"], "paint": ["I paint a picture of the sea.", "我画了一幅大海的画。"], "january": ["January is the first month.", "一月是第一个月。"], "february": ["February is cold here.", "这里的二月很冷。"], "march": ["March comes after February.", "三月在二月之后。"], "april": ["April has thirty days.", "四月有三十天。"], "may": ["May Day is a holiday.", "五一是假日。"], "june": ["Children's Day is in June.", "儿童节在六月。"], "july": ["July is hot in Xiamen.", "厦门的七月很热。"], "august": ["August is in summer.", "八月在夏天。"], "september": ["School starts in September.", "学校在九月开学。"], "october": ["National Day is in October.", "国庆节在十月。"], "november": ["November is cool.", "十一月很凉爽。"], "december": ["December is the last month.", "十二月是最后一个月。"], "few": ["Few people are in the street.", "街上人很少。"], "a few": ["I have a few good friends.", "我有一些好朋友。"], "thing": ["There is one more thing to do.", "还有一件事情要做。"], "meet": ["Let's meet at the school gate.", "我们在校门口见面吧。"], "sports meet": ["The sports meet is in April.", "运动会在四月举行。"], "easter": ["Children look for eggs at Easter.", "孩子们在复活节找彩蛋。"], "trip": ["We have a trip to Beijing.", "我们有一次北京之旅。"], "year": ["This year I am eleven.", "今年我十一岁。"], "contest": ["He wins the singing contest.", "他赢得了歌唱比赛。"], "the great wall": ["The Great Wall is very long.", "长城非常长。"], "national": ["October 1st is National Day.", "十月一日是国庆日。"], "national day": ["We have a holiday on National Day.", "国庆日我们放假。"], "american": ["Thanksgiving is an American holiday.", "感恩节是美国的节日。"], "thanksgiving": ["Families get together on Thanksgiving.", "感恩节家人会聚在一起。"], "christmas": ["We sing songs at Christmas.", "我们在圣诞节唱歌。"], "holiday": ["The holiday is seven days long.", "这个假日有七天。"], "game": ["Let's play a game together.", "我们一起玩个游戏吧。"], "roll": ["The ball can roll fast.", "球可以滚得很快。"], "look for": ["I look for my keys everywhere.", "我到处寻找我的钥匙。"], "chocolate": ["Chocolate is sweet and yummy.", "巧克力又甜又好吃。"], "bunny": ["The bunny has white fur.", "小兔子有白色的皮毛。"], "rsvp": ["Please RSVP before Friday.", "请在星期五之前赐复。"], "by": ["Finish it by Friday, please.", "请在星期五之前完成它。"], "first": ["January is the first month.", "一月是第一个月。"], "second": ["He is the second in line.", "他排在第二位。"], "third": ["The third book is mine.", "第三本书是我的。"], "fourth": ["April is the fourth month.", "四月是第四个月。"], "fifth": ["May is the fifth month.", "五月是第五个月。"], "twelfth": ["December is the twelfth month.", "十二月是第十二个月。"], "twentieth": ["Today is the twentieth of May.", "今天是五月二十日。"], "twenty-first": ["His birthday is on the twenty-first.", "他的生日在二十一日。"], "twenty-third": ["The meeting is on the twenty-third.", "会议在二十三日。"], "thirtieth": ["April the thirtieth is her birthday.", "四月三十日是她的生日。"], "special": ["Today is a special day.", "今天是个特别的日子。"], "fool": ["Don't be a fool. Think first.", "别做傻瓜，先想一想。"], "kitten": ["The kitten is small and lovely.", "这只小猫又小又可爱。"], "diary": ["I write in my diary every day.", "我每天写日记。"], "still": ["He is still at school.", "他仍然在学校。"], "noise": ["Don't make noise in the library.", "不要在图书馆制造噪音。"], "fur": ["The dog has soft fur.", "狗有柔软的皮毛。"], "open": ["The door is open.", "门开着。"], "walk": ["We walk to school every day.", "我们每天走路去上学。"], "mine": ["This book is mine.", "这本书是我的。"], "yours": ["Is this pen yours?", "这支笔是你的吗？"], "his": ["His bag is blue.", "他的书包是蓝色的。"], "hers": ["The red dress is hers.", "红裙子是她的。"], "theirs": ["The big house is theirs.", "那栋大房子是他们的。"], "ours": ["The classroom is ours.", "这间教室是我们的。"], "climbing": ["The monkeys are climbing the tree.", "猴子们正在爬树。"], "eating": ["The panda is eating bamboo.", "熊猫正在吃竹子。"], "playing": ["The children are playing outside.", "孩子们正在外面玩耍。"], "jumping": ["The rabbit is jumping.", "兔子正在跳。"], "drinking": ["The cat is drinking milk.", "猫正在喝牛奶。"], "sleeping": ["The baby is sleeping now.", "宝宝现在正在睡觉。"], "each": ["Each child has a balloon.", "每个孩子都有一个气球。"], "other": ["The other book is on the desk.", "另一本书在桌子上。"], "each other": ["We help each other.", "我们互相帮助。"], "excited": ["We are excited about the trip.", "我们对旅行很兴奋。"], "like": ["She sings like a bird.", "她唱歌像小鸟一样。"], "doing morning exercises": ["They are doing morning exercises now.", "他们正在做早操。"], "having...class": ["We are having an English class now.", "我们正在上英语课。"], "eating lunch": ["The students are eating lunch.", "学生们正在吃午饭。"], "reading a book": ["Grandpa is reading a book.", "爷爷正在看书。"], "listening to music": ["She is listening to music.", "她正在听音乐。"], "keep": ["Keep your room clean.", "保持你的房间干净。"], "keep to the right": ["Keep to the right on the road.", "在路上靠右行。"], "keep your desk clean": ["Keep your desk clean, please.", "请保持你的课桌干净。"], "talk quietly": ["Talk quietly in the library.", "在图书馆小声讲话。"], "turn": ["It's my turn to read.", "轮到我读书了。"], "take turns": ["Take turns to play the game.", "按顺序轮流玩游戏。"], "bamboo": ["Pandas eat bamboo.", "熊猫吃竹子。"], "its": ["The dog wags its tail.", "狗摇着它的尾巴。"], "show": ["Show me your new book.", "把你的新书给我看看。"], "anything": ["Do you want anything to drink?", "你想喝点什么吗？"], "else": ["What else do you want?", "你还想要别的什么？"], "exhibition": ["There is an art exhibition at school.", "学校有一个艺术展览。"], "say": ["Say it in English, please.", "请用英语说。"], "have a look": ["Let's have a look at the photos.", "我们看一看这些照片吧。"], "sushi": ["Sushi is from Japan.", "寿司来自日本。"], "teach": ["Miss Li teaches us English.", "李老师教我们英语。"], "sure": ["Sure, I can help you.", "当然，我可以帮你。"], "canadian": ["He is a Canadian boy.", "他是一个加拿大男孩。"], "spanish": ["She can speak Spanish.", "她会说西班牙语。"], "science": ["Science is interesting and fun.", "科学有趣又好玩。"], "museum": ["We visit the museum on Sunday.", "我们星期日参观博物馆。"], "post office": ["The post office is near my home.", "邮局离我家很近。"], "bookstore": ["I buy a book at the bookstore.", "我在书店买了一本书。"], "cinema": ["Let's go to the cinema tonight.", "我们今晚去电影院吧。"], "hospital": ["The hospital is next to the park.", "医院在公园旁边。"], "crossing": ["Be careful at the crossing.", "在十字路口要小心。"], "left": ["Turn left at the crossing.", "在十字路口左转。"], "straight": ["Go straight and you'll see it.", "笔直走，你就会看到它。"], "right": ["The shop is on the right.", "商店在右边。"], "ask": ["Ask the teacher if you don't know.", "不知道就问老师。"], "sir": ["Excuse me, sir. Where is the zoo?", "先生，打扰一下，动物园在哪儿？"], "interesting": ["This book is very interesting.", "这本书非常有趣。"], "italian": ["Pizza is Italian food.", "比萨饼是意大利的食物。"], "restaurant": ["We eat at a restaurant on Sunday.", "我们星期日在餐馆吃饭。"], "pizza": ["I like pizza with cheese.", "我喜欢奶酪比萨饼。"], "street": ["The street is clean and wide.", "这条大街干净又宽阔。"], "get": ["How can I get to the museum?", "我怎么到达博物馆？"], "bds": ["BDS helps us find the way.", "北斗卫星导航系统帮我们找路。"], "gave": ["He gave me a map of the city.", "他给了我一张城市地图。"], "feature": ["This is a special feature of the phone.", "这是这部手机的一个特点。"], "follow": ["Follow me, please.", "请跟着我。"], "far": ["The museum is far from here.", "博物馆离这里很远。"], "tell": ["Tell me about your school.", "告诉我你的学校吧。"], "on foot": ["We go to school on foot.", "我们步行去上学。"], "bus": ["I go home by bus.", "我坐公共汽车回家。"], "plane": ["We go to Beijing by plane.", "我们坐飞机去北京。"], "taxi": ["Let's take a taxi to the airport.", "我们坐出租汽车去机场吧。"], "ship": ["The ship is big and fast.", "这艘大船又大又快。"], "subway": ["The subway is quick and clean.", "地铁又快又干净。"], "train": ["We travel by train.", "我们坐火车旅行。"], "slow": ["The bus is slow today.", "今天的公交车很慢。"], "down": ["Slow down at the crossing.", "在十字路口慢下来。"], "slow down": ["Please slow down near the school.", "在学校附近请慢下来。"], "stop": ["The car must stop at the red light.", "汽车必须在红灯时停下。"], "mrs": ["Mrs Green is our music teacher.", "格林夫人是我们的音乐老师。"], "early": ["I get up early every day.", "我每天早起。"], "helmet": ["Wear a helmet on the bike.", "骑自行车要戴头盔。"], "must": ["You must stop at a red light.", "红灯时你必须停下。"], "wear": ["Wear your helmet, please.", "请戴上你的头盔。"], "attention": ["Pay attention to the traffic lights.", "要注意交通信号灯。"], "pay attention to": ["Pay attention to your teacher.", "要注意听老师讲。"], "traffic": ["The traffic is heavy in the morning.", "早上的交通很拥堵。"], "traffic lights": ["Stop when the traffic lights are red.", "交通信号灯红灯时要停下。"], "munich": ["Munich is a city in Germany.", "慕尼黑是德国的一座城市。"], "germany": ["Munich is in Germany.", "慕尼黑在德国。"], "alaska": ["Alaska is very cold in winter.", "阿拉斯加州冬天非常冷。"], "sled": ["Children ride a sled in the snow.", "孩子们在雪地里坐雪橇。"], "fast": ["The train is very fast.", "火车非常快。"], "ferry": ["We go to the island by ferry.", "我们坐轮渡去岛上。"], "papa westray": ["Papa Westray is a small island.", "帕帕韦斯特雷岛是一个小岛。"], "scotland": ["Papa Westray is in Scotland.", "帕帕韦斯特雷岛在苏格兰。"], "visit": ["We visit my grandparents on Sunday.", "我们星期日拜访祖辈。"], "film": ["The film is interesting.", "这部电影很有趣。"], "see a film": ["Let's see a film this evening.", "我们今晚看电影吧。"], "take a trip": ["We take a trip in summer.", "我们夏天去旅行。"], "supermarket": ["Mum buys fruit at the supermarket.", "妈妈在超市买水果。"], "evening": ["We watch TV in the evening.", "我们晚上看电视。"], "tonight": ["I will do my homework tonight.", "我今晚做作业。"], "tomorrow": ["Tomorrow is Saturday.", "明天是星期六。"], "next week": ["We have a test next week.", "我们下周有考试。"], "dictionary": ["Look up the word in the dictionary.", "在词典里查这个单词。"], "comic": ["The comic book is funny.", "这本连环画册很滑稽。"], "comic book": ["He reads a comic book.", "他看一本连环画册。"], "word": ["This word is hard for me.", "这个单词对我来说很难。"], "word book": ["Take out your word book.", "拿出你的单词书。"], "postcard": ["I send a postcard to my friend.", "我给朋友寄一张明信片。"], "lesson": ["We have an English lesson today.", "我们今天有一节英语课。"], "space": ["He wants to travel in space.", "他想在太空旅行。"], "travel": ["We travel to Beijing in July.", "我们七月去北京旅行。"], "half": ["Half of the cake is for you.", "一半蛋糕是给你的。"], "price": ["The price of the book is ten yuan.", "这本书的价格是十元。"], "mid-autumn festival": ["We eat mooncakes on Mid-Autumn Festival.", "我们在中秋节吃月饼。"], "together": ["We play together after school.", "我们放学后一起玩。"], "get together": ["Families get together at Spring Festival.", "春节时家人聚会。"], "mooncake": ["The mooncake is sweet.", "月饼很甜。"], "poem": ["He reads a poem about the moon.", "他读一首关于月亮的诗。"], "moon": ["The moon is round and bright.", "月亮又圆又亮。"], "studies": ["She studies English every day.", "她每天学习英语。"], "puzzle": ["This puzzle is hard but fun.", "这个谜很难但很有趣。"], "hiking": ["Hiking is good exercise.", "远足是很好的运动。"], "pen pal": ["My pen pal lives in Canberra.", "我的笔友住在堪培拉。"], "hobby": ["Reading is my hobby.", "阅读是我的业余爱好。"], "jasmine": ["Jasmine flowers smell sweet.", "茉莉花闻起来很香。"], "idea": ["That's a good idea!", "那是个好主意！"], "canberra": ["Canberra is a city in Australia.", "堪培拉是澳大利亚的一座城市。"], "amazing": ["What an amazing film!", "多么令人惊奇的电影啊！"], "shall": ["Shall we go to the park?", "我们去公园好吗？"], "goal": ["He scores a goal!", "他射门得分了！"], "join": ["I want to join the football club.", "我想加入足球俱乐部。"], "club": ["Our school has a singing club.", "我们学校有一个歌唱俱乐部。"], "share": ["Share your book with me, please.", "请和我分享你的书。"], "factory": ["My uncle works in a factory.", "我叔叔在一家工厂工作。"], "worker": ["The worker is busy in the factory.", "工人在工厂里忙碌。"], "postman": ["The postman brings us letters.", "邮递员给我们送信。"], "businessman": ["His father is a businessman.", "他的爸爸是一位商人。"], "police officer": ["The police officer helps people.", "警察帮助人们。"], "fisherman": ["The fisherman works on the sea.", "渔民在海上工作。"], "scientist": ["I want to be a scientist.", "我想成为一名科学家。"], "pilot": ["The pilot flies a plane.", "飞行员驾驶飞机。"], "coach": ["Our coach is strict but kind.", "我们的教练严格但和善。"], "country": ["China is a big country.", "中国是一个大国家。"], "head teacher": ["Our head teacher is Mr Wang.", "我们的校长是王先生。"], "sea": ["The sea is blue and wide.", "大海蔚蓝又宽广。"], "stay": ["Stay healthy and happy!", "保持健康和快乐！"], "university": ["My sister studies at a university.", "我姐姐在一所大学学习。"], "gym": ["We play sports at the gym.", "我们在体育馆做运动。"], "if": ["If it rains, we stay at home.", "如果下雨，我们就待在家里。"], "reporter": ["The reporter asks many questions.", "记者问了许多问题。"], "use": ["I use the computer to study.", "我用电脑学习。"], "type": ["She can type very fast.", "她打字非常快。"], "quickly": ["He runs quickly to school.", "他快速跑向学校。"], "secretary": ["The secretary types letters.", "秘书打字写信。"], "angry": ["Mum is angry with the noise.", "妈妈对噪音很生气。"], "afraid": ["The little dog is afraid of thunder.", "小狗害怕打雷。"], "sad": ["He is sad because his cat is ill.", "他很难过，因为他的猫病了。"], "worried": ["Mum is worried about my test.", "妈妈担心我的考试。"], "happy": ["We are happy at the party.", "我们在聚会上很高兴。"], "see a doctor": ["You should see a doctor.", "你应该去看病。"], "more": ["Drink more water when you are ill.", "生病时多喝水。"], "deep": ["The river is deep here.", "这条河在这里很深。"], "breath": ["Take a deep breath and count to ten.", "深深吸一口气，数到十。"], "take a deep breath": ["Take a deep breath when you are angry.", "生气时深深吸一口气。"], "count": ["Count the apples on the table.", "数一数桌子上的苹果。"], "count to ten": ["Count to ten and feel better.", "数到十，心情会好些。"], "chase": ["The cat likes to chase mice.", "猫喜欢追赶老鼠。"], "mice": ["Cats chase mice.", "猫追赶老鼠。"], "bad": ["The bad cat chases the mice.", "这只坏猫追赶老鼠。"], "hurt": ["The cat can hurt the mice.", "猫会使老鼠受伤。"], "ill": ["He is ill and stays at home.", "他生病了，待在家里。"], "wrong": ["Something is wrong with my bike.", "我的自行车有毛病。"], "feel": ["I feel happy today.", "我今天觉得很高兴。"], "well": ["I don't feel well today.", "我今天感觉身体不好。"], "sit": ["Sit on the grass and have a rest.", "坐在草坪上休息一下。"], "grass": ["Don't walk on the grass.", "不要在草坪上行走。"], "hear": ["I hear birds singing.", "我听见鸟儿在唱歌。"], "ant": ["The ant is small but strong.", "蚂蚁虽小但很有力气。"], "worry": ["Don't worry about the test.", "不要担心考试。"], "stuck": ["The car is stuck in the mud.", "汽车陷在泥里了。"], "mud": ["His shoes are full of mud.", "他的鞋子上满是泥。"], "pull": ["We pull the car out of the mud.", "我们把汽车从泥里拉出来。"], "everyone": ["Everyone helps to pull the car.", "每个人都帮忙拉车。"], "younger": ["My sister is younger than me.", "我妹妹比我更年轻。"], "older": ["His brother is older than him.", "他的哥哥比他年长。"], "taller": ["Tom is taller than Jack.", "汤姆比杰克更高。"], "shorter": ["This ruler is shorter than that one.", "这把尺子比那把更短。"], "longer": ["The river is longer than the road.", "这条河比这条路更长。"], "thinner": ["The cat is thinner than the dog.", "猫比狗更瘦。"], "heavier": ["The box is heavier than the bag.", "箱子比包更重。"], "bigger": ["An elephant is bigger than a horse.", "大象比马更大。"], "smaller": ["A mouse is smaller than a cat.", "老鼠比猫更小。"], "stronger": ["My dad is stronger than me.", "我爸爸比我更强壮。"], "dinosaur": ["The dinosaur is very big.", "恐龙非常大。"], "hall": ["We have lunch in the dining hall.", "我们在饭厅吃午饭。"], "metre": ["The tree is ten metres tall.", "这棵树有十米高。"], "than": ["She is taller than me.", "她比我高。"], "both": ["Both of my parents are teachers.", "我的父母都是老师。"], "kilogram": ["The bag is five kilograms.", "这个包有五千克。"], "countryside": ["My grandpa lives in the countryside.", "我爷爷住在乡村。"], "lower": ["The sun goes lower in the evening.", "傍晚太阳落得更低。"], "shadow": ["The tree has a long shadow.", "这棵树有长长的影子。"], "smarter": ["Dogs are smarter than we think.", "狗比我们想的更聪明。"], "become": ["The days become longer in spring.", "春天白天变得更长。"], "cleaned": ["I cleaned my room yesterday.", "我昨天打扫了我的房间。"], "stayed": ["We stayed at home last Sunday.", "上星期日我们待在家里。"], "washed": ["She washed her clothes last night.", "她昨晚洗了她的衣服。"], "watched": ["We watched a film yesterday.", "我们昨天看了一部电影。"], "had": ["He had a cold last week.", "他上星期感冒了。"], "had a cold": ["I had a cold and stayed in bed.", "我感冒了，躺在床上。"], "slept": ["The baby slept all night.", "宝宝睡了一整夜。"], "saw": ["I saw a dinosaur at the museum.", "我在博物馆看到了一只恐龙。"], "yesterday": ["Yesterday was a sunny day.", "昨天是个晴天。"], "before": ["Wash your hands before dinner.", "晚饭前洗手。"], "drank": ["He drank some water after running.", "跑步后他喝了一些水。"], "magazine": ["Dad reads a magazine after dinner.", "爸爸晚饭后看杂志。"], "better": ["I feel better today.", "我今天感觉更好了。"], "faster": ["A cheetah runs faster than a dog.", "猎豹比狗跑得更快。"], "hotel": ["We stayed in a hotel by the sea.", "我们住在海边的一家旅馆。"], "fixed": ["Dad fixed my broken bike.", "爸爸修理了我的坏自行车。"], "broken": ["The lamp is broken.", "台灯坏了。"], "lamp": ["Turn on the lamp, please.", "请打开台灯。"], "loud": ["The music is too loud.", "音乐声太大了。"], "enjoy": ["We enjoy our time at the beach.", "我们享受在海滩的时光。"], "went": ["We went to the park yesterday.", "我们昨天去了公园。"], "camp": ["We sleep in a tent at the camp.", "我们在营地睡帐篷。"], "went camping": ["We went camping last weekend.", "上周末我们去野营了。"], "fish": ["They fish by the river.", "他们在河边钓鱼。"], "went fishing": ["Grandpa went fishing this morning.", "爷爷今天早上去钓鱼了。"], "rode": ["He rode a horse on the farm.", "他在农场骑马。"], "ate": ["We ate mooncakes last night.", "我们昨晚吃了月饼。"], "took": ["She took many photos on the trip.", "她在旅行中拍了很多照片。"], "took pictures": ["We took pictures at the beach.", "我们在海滩照相。"], "bought": ["Mum bought me a gift.", "妈妈给我买了一件礼物。"], "gift": ["This gift is for you.", "这件礼物是给你的。"], "fell": ["The boy fell off his bike.", "男孩从自行车上摔倒了。"], "off": ["He fell off the horse.", "他从马上落下来。"], "labour day": ["We have a holiday on Labour Day.", "劳动节我们放假。"], "mule": ["A mule works on the farm.", "骡子在农场干活。"], "turpan": ["Turpan is hot in summer.", "吐鲁番夏天很热。"], "could": ["I could swim when I was six.", "我六岁时就能游泳。"], "till": ["We played till dinner time.", "我们一直玩到晚饭时间。"], "beach": ["We play on the beach in summer.", "夏天我们在海滩上玩。"], "basket": ["The basket is full of apples.", "篮子里装满了苹果。"], "part": ["He plays the part of a king.", "他扮演国王的角色。"], "licked": ["The dog licked my hand.", "狗舔了我的手。"], "laughed": ["We laughed at the funny story.", "我们被这个有趣的故事逗笑了。"], "dining hall": ["The dining hall is big and clean.", "饭厅又大又干净。"], "ago": ["We moved here two years ago.", "我们两年前搬到这里。"], "cycling": ["Cycling is my favourite sport.", "骑自行车运动是我最喜欢的运动。"], "go cycling": ["Let's go cycling this weekend.", "我们这个周末去骑自行车吧。"], "ice-skate": ["We ice-skate in winter.", "我们冬天滑冰。"], "badminton": ["I play badminton with my friend.", "我和朋友打羽毛球运动。"], "star": ["The star shines in the sky.", "星星在天空中闪耀。"], "easy": ["This question is easy.", "这个问题很容易。"], "look up": ["Look up the word in your book.", "在你的书里查阅这个词。"], "internet": ["We can learn on the Internet.", "我们可以在互联网上学习。"], "different": ["Dogs and cats are different.", "狗和猫是不同的。"], "active": ["He is active in class.", "他在课上很积极。"], "race": ["I run a race with my friends.", "我和朋友们赛跑。"], "nothing": ["There is nothing in the box.", "盒子里没有什么。"], "thought": ["I thought it was easy.", "我原以为它很容易。"], "felt": ["She felt happy after the race.", "赛跑后她感觉很开心。"], "cheetah": ["The cheetah runs very fast.", "猎豹跑得非常快。"], "woke": ["I woke up early this morning.", "我今天早上醒得很早。"], "dream": ["I had a nice dream last night.", "我昨晚做了一个美梦。"]};
    function maskWord(word, level) {
        return word.split(' ').map(function(part) {
        var out = '';
        for (var i = 0; i < part.length; i++) {
            var show = false;
            if (level === 1) show = i === 0;
            else if (level === 2) show = i % 2 === 0;
            else show = i < part.length - 1;
            out += show ? part[i] : '_';
        }
        return out.split('').join(' ');
        }).join('   ');
    }
    function showHint(btn, word) {
        var card = btn.closest('.word-item');
        var line = card.querySelector('.hint-line');
        var lv = parseInt(line.getAttribute('data-lv') || '0', 10) + 1;
        if (lv > 3) lv = 1;
        line.setAttribute('data-lv', lv);
        line.innerText = '💡 提示 ' + lv + '/3：' + maskWord(word, lv);
        line.style.display = 'block';
    }
    function toggleExample(btn, word) {
        var card = btn.closest('.word-item');
        var line = card.querySelector('.ex-line');
        if (line.style.display === 'block') { line.style.display = 'none'; return; }
        var ex = EXAMPLES[String(word).toLowerCase()];
        if (!ex) { line.innerText = '📖 这个词还没有例句，让爸爸妈妈编一句吧。'; }
        else {
        var s = ex[0];
        var idx = s.toLowerCase().indexOf(String(word).toLowerCase());
        if (idx >= 0) s = s.slice(0, idx) + '______' + s.slice(idx + word.length);
        line.innerText = '📖 ' + s + '（' + ex[1] + '）';
        }
        line.style.display = 'block';
    }
    var reverseActive = false;
    function updateReverseBtn() { var b = document.getElementById('reverseBtn'); if (b) b.innerText = reverseActive ? '↩️ 退出反向选义' : '🔁 反向选义（看英文选中文）'; }
    function resetReverse() { reverseActive = false; updateReverseBtn(); }
    /* ===== 打印词单 / 听写纸 ===== */
function printEsc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function openPrintModal() {
    if (typeof allWordData === 'undefined' || !allWordData.length) { alert('先选一册书、一个单元或一份词单，把词加载出来再打印。'); return; }
    document.getElementById('printModalInfo').textContent = '当前词单共 ' + allWordData.length + ' 词，选一种打印：';
    document.getElementById('printModal').classList.add('open');
}
function closePrintModal() { document.getElementById('printModal').classList.remove('open'); }
function doPrintChoice(kind) { closePrintModal(); setTimeout(function() { printWordList(kind); }, 80); }
function printWordList(kind) {
    if (typeof allWordData === 'undefined' || !allWordData.length) { alert('先选一册书、一个单元或一份词单，把词加载出来再打印。'); return; }
    var statusEl = document.querySelector('.file-status');
    var title = statusEl ? statusEl.textContent.replace(/^\s*已加载[:：]\s*/, '').replace(/\.csv.*$/, '') : '';
    if (!title || title.indexOf('未') === 0) title = '单词表';
    var now = new Date();
    var ds = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    var rows = '', i, w;
    if (kind === 'dictation') {
        for (i = 0; i < allWordData.length; i++) { w = allWordData[i]; rows += '<tr><td>' + (i + 1) + '</td><td class="zh">' + printEsc(w.chinese) + '</td><td class="write"></td></tr>'; }
        document.getElementById('printArea').innerHTML = '<h1>' + printEsc(title) + ' · 听写纸</h1>' +
            '<p class="pmeta">姓名：____________　日期：____________　共 ' + allWordData.length + ' 词（看中文，默写英文）</p>' +
            '<table><tr><th style="width:8%">#</th><th style="width:34%">中文</th><th>默写英文</th></tr>' + rows + '</table>';
    } else {
        for (i = 0; i < allWordData.length; i++) { w = allWordData[i]; rows += '<tr><td>' + (i + 1) + '</td><td class="en">' + printEsc(w.english) + '</td><td class="zh">' + printEsc(w.chinese) + '</td></tr>'; }
        document.getElementById('printArea').innerHTML = '<h1>' + printEsc(title) + '</h1>' +
            '<p class="pmeta">共 ' + allWordData.length + ' 词 · ' + ds + '</p>' +
            '<table><tr><th style="width:8%">#</th><th style="width:42%">英文</th><th>中文</th></tr>' + rows + '</table>';
    }
    window.print();
}
function toggleReverse() {
        if (reverseActive) { reverseActive = false; updateReverseBtn(); renderPage(); }
        else { reverseActive = true; updateReverseBtn(); renderReverse(); }
    }
    function renderReverse() {
        var pool = (typeof allWordData !== 'undefined' && allWordData) ? allWordData : [];
        if (!pool.length) { alert('先加载一个词库（点教材词库、学校进度或DIY），再来玩反向选义。'); reverseActive = false; updateReverseBtn(); return; }
        var html = '<div class="rev-head">🔁 反向选义：看英文，选出正确的中文意思</div>';
        pool.forEach(function(w) {
        var others = [];
        pool.forEach(function(x) { if (x.chinese !== w.chinese && others.indexOf(x.chinese) < 0) others.push(x.chinese); });
        others.sort(function() { return Math.random() - 0.5; });
        var opts = [w.chinese].concat(others.slice(0, 3));
        opts.sort(function() { return Math.random() - 0.5; });
        var wq = escHtml(w.english).replace(/'/g, "\\'");
        html += '<div class="word-item rev-card"><div class="rev-word">' + escHtml(w.english) + ' <button class="btn-icon btn-sound" onclick="playSound(\'' + wq + '\')">🔊</button></div><div class="rev-opts">';
        opts.forEach(function(o) { html += '<button class="rev-opt" data-correct="' + (o === w.chinese ? '1' : '0') + '" onclick="answerReverse(this, \'' + wq + '\')">' + escHtml(o) + '</button>'; });
        html += '</div><div class="rev-feedback"></div></div>';
        });
        document.getElementById('wordList').innerHTML = html;
        var st = document.getElementById('fileStatus'); if (st) st.innerText = '反向选义：共 ' + pool.length + ' 个词';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function answerReverse(btn, word) {
        var card = btn.closest('.rev-card');
        if (card.dataset.done) return;
        var fb = card.querySelector('.rev-feedback');
        if (btn.getAttribute('data-correct') === '1') {
        if (!card.dataset.failed && typeof TrialGate !== 'undefined' && !TrialGate.allow(word)) { showTrialLock(); return; }
        btn.classList.add('rev-ok');
        card.dataset.done = '1';
        if (!card.dataset.failed) { WordStats.update(word, true); if (typeof playCorrectSound === 'function') playCorrectSound(); }
        fb.innerText = '✅ 答对了！'; fb.style.color = '#46A302';
        } else {
        if (!card.dataset.failed && typeof TrialGate !== 'undefined' && !TrialGate.allow(word)) { showTrialLock(); return; }
        btn.classList.add('rev-bad'); btn.disabled = true;
        if (!card.dataset.failed) { card.dataset.failed = '1'; WordStats.update(word, false); }
        fb.innerText = '❌ 不是这个，再想想'; fb.style.color = '#FF4B4B';
        }
    }
    function dailyStreak() {
        var all = DailyLog.load();
        function keyOf(d) { function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
        var d = new Date();
        if (!all[keyOf(d)] || !all[keyOf(d)].a) d.setDate(d.getDate() - 1);
        var n = 0;
        while (all[keyOf(d)] && all[keyOf(d)].a > 0) { n++; d.setDate(d.getDate() - 1); }
        return n;
    }
                    // --- Daily learning record (每日完成情况 + 错误率) ---
    var DailyLog = {
        KEY: 'word_spelling_daily',
        load: function() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
        save: function(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {} },
        todayKey: function() { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },
        record: function(word, isCorrect) {
        var all = this.load(); var k = this.todayKey();
        var day = all[k] || { a: 0, c: 0, w: 0, words: {} };
        day.a++; if (isCorrect) day.c++; else day.w++;
        if (word) day.words[word] = 1;
        all[k] = day; this.save(all);
        },
        rows: function() {
        var all = this.load();
        return Object.keys(all).sort().reverse().map(function(k) {
            var d = all[k];
            return { date: k, a: d.a, c: d.c, w: d.w, u: Object.keys(d.words || {}).length, rate: d.a ? Math.round(d.w / d.a * 100) : 0 };
        });
        }
    };
    function rateClass(r) { return r <= 15 ? 'rate-good' : (r <= 35 ? 'rate-mid' : 'rate-bad'); }
    function openDailyModal() { renderDaily(); document.getElementById('dailyModal').style.display = 'flex'; }
    function closeDailyModal() { document.getElementById('dailyModal').style.display = 'none'; }
    function renderDaily() {
        var el = document.getElementById('dailyContent');
        var rows = DailyLog.rows();
        if (!rows.length) { el.innerHTML = '<p style="color:#888; line-height:1.9;">还没有记录。从今天开始，每次练习都会自动记下来：哪天练了多少、答对答错多少、错误率多少，都在这里看。</p>'; return; }
        var tk = DailyLog.todayKey();
        var streak = dailyStreak();
        var t = null, ta = 0, tc = 0, tw = 0;
        rows.forEach(function(r) { ta += r.a; tc += r.c; tw += r.w; if (r.date === tk) t = r; });
        var html = '';
        if (t) {
        html += '<div class="daily-today">🔥 连续学习 <strong>' + streak + '</strong> 天 · 累计学习 ' + rows.length + ' 天，继续加油！</div>';
        html += '<div class="daily-today"><strong>今天（' + t.date + '）</strong><br>练习 <strong>' + t.a + '</strong> 词次 · ✅ 答对 ' + t.c + ' · ❌ 答错 ' + t.w + ' · 错误率 <span class="' + rateClass(t.rate) + '">' + t.rate + '%</span> · 一共练了 ' + t.u + ' 个不同的词</div>';
        } else {
        html += '<div class="daily-today"><strong>今天（' + tk + '）</strong><br>今天还没开始练习，点一个词库开始吧。</div>';
        }
        html += '<table class="daily-table"><tr><th>日期</th><th>练习</th><th>答对</th><th>答错</th><th>错误率</th><th>单词数</th></tr>';
        rows.forEach(function(r) {
        html += '<tr' + (r.date === tk ? ' class="today-row"' : '') + '><td>' + r.date + (r.date === tk ? '（今天）' : '') + '</td><td>' + r.a + '</td><td>' + r.c + '</td><td>' + r.w + '</td><td class="' + rateClass(r.rate) + '">' + r.rate + '%</td><td>' + r.u + '</td></tr>';
        });
        html += '</table>';
        var totalRate = ta ? Math.round(tw / ta * 100) : 0;
        html += '<p style="color:#888; margin-top:12px;">累计 ' + rows.length + ' 天 · 总练习 ' + ta + ' 词次 · 总错误率 <span class="' + rateClass(totalRate) + '">' + totalRate + '%</span>（错误率 ≤15% 绿色 · ≤35% 黄色 · 更高红色）</p>';
        el.innerHTML = html;
    }
        // --- Free trial gate: guests may try 3 words; login removes the limit ---
    var TrialGate = {
        KEY: 'word_spelling_trial_words',
        LIMIT: 3,
        used: function() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch (e) { return []; } },
        isLoggedIn: function() { return typeof currentUser !== 'undefined' && !!currentUser; },
        allow: function(word) {
        if (this.isLoggedIn()) return true;
        var u = this.used();
        if (u.indexOf(word) >= 0) return true;
        if (u.length >= this.LIMIT) return false;
        u.push(word);
        try { localStorage.setItem(this.KEY, JSON.stringify(u)); } catch (e) {}
        return true;
        },
        remaining: function() { return Math.max(0, this.LIMIT - this.used().length); }
    };
    function showTrialLock() { document.getElementById('trialModal').style.display = 'flex'; }
    function closeTrialModal() { document.getElementById('trialModal').style.display = 'none'; }
    function trialLogin() { closeTrialModal(); if (typeof openAuthModal === 'function') openAuthModal(); }
    function parseCSVData(text, filename, save) {
            save = save !== false;
            allWordData = text.split('\n').map(function(line) {
                const parts = line.split(',');
                return parts.length >= 2 ? { english: parts[0].trim(), chinese: parts.slice(1).join(',').trim() } : null;
            }).filter(function(word) { return word && word.english && word.chinese; });

            if (allWordData.length > 0) {
                if (save) {
                    DataPersistence.save(filename, text);
                    DataPersistence.savePage(1);
                }
                document.querySelector('.file-status').textContent = '已加载: ' + filename + ' (' + allWordData.length + '个单词)';
                document.querySelector('.file-status').style.color = '#28a745';
                filterData();
                if (save) { renderPage(1); renderPagination(); }
            } else {
                showExampleData();
            }
        }

        function showExampleData() {
            allWordData = [
                { english: 'hello', chinese: '你好' },
                { english: 'world', chinese: '世界' },
                { english: 'computer', chinese: '计算机' },
                { english: 'mobile', chinese: '移动的' },
                { english: 'tablet', chinese: '平板电脑' }
            ];
            document.querySelector('.file-status').innerHTML = '当前使用示例数据 (5个单词)<br><span style="font-size:11px;">点击上方"选择文件"导入您的CSV词库</span>';
            document.querySelector('.file-status').style.color = '#ffc107';
            filterData();
            renderPage(1);
            renderPagination();
        }

        // --- Theme ---
        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'dark' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }

        // --- Library ---
        let libraryFiles = [];

        function toggleLibrary() {
            const drawer = document.getElementById('libraryDrawer');
            drawer.classList.toggle('open');
            if (drawer.classList.contains('open')) loadSharedWordlists();
        }

        function handleFolderSelect(input) {
            const files = Array.from(input.files).filter(function(f) { return f.name.endsWith('.csv') || f.name.endsWith('.txt'); });
            if (files.length === 0) { showToast('未找到CSV或TXT文件', 'error'); return; }
            files.sort(function(a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }); });
            libraryFiles = files;
            renderLibraryList();
        }

        var sharedWordlistNames = [];

        async function loadSharedWordlists() {
            if (!authToken) return;
            try {
                var resp = await API.wordlists.list();
                sharedWordlistNames = (resp.files || []).map(function(f) { return f.name; });
            } catch(e) { sharedWordlistNames = []; }
            renderLibraryList();
        }

        function renderLibraryList() {
            var list = document.getElementById('libraryList');
            var html = libraryFiles.map(function(file, index) {
                return '<li class="library-item" onclick="loadLibraryFile(' + index + ')">' + file.name + '</li>';
            }).join('');
            if (sharedWordlistNames.length > 0) {
                html += '<li style="padding:8px 12px; font-size:12px; color:var(--text-secondary); border-bottom:1px solid var(--border-color);">共享词库</li>';
                html += sharedWordlistNames.map(function(name) {
                    var safeName = name.replace(/'/g, "\\'");
                    return '<li class="library-item" onclick="loadSharedWordlist(\'' + safeName + '\')">' + name + '</li>';
                }).join('');
            }
            list.innerHTML = html;
        }

        async function loadSharedWordlist(filename) {
            try {
                var text = await API.wordlists.getContent(filename);
                parseCSVData(text, filename);
                if (window.innerWidth < 768) toggleLibrary();
            } catch(e) { showToast('加载失败: ' + e.message, 'error'); }
        }

        function loadLibraryFile(index) {
            const file = libraryFiles[index];
            if (!file) return;
            document.querySelectorAll('.library-item').forEach(function(el, i) { el.classList.toggle('active', i === index); });
            const reader = new FileReader();
            reader.onload = function(e) { parseCSVData(e.target.result, file.name); if (window.innerWidth < 768) toggleLibrary(); };
            reader.readAsText(file);
        }

        // --- Daily practice ---
        function recordDailyPractice(correct, wrong) {
            if (!currentUser) return;
            try { API.stats.saveDaily(correct, wrong).catch(function(){}); } catch(e) {}
        }

        // --- Stats dashboard ---
        async function showStatsDashboard() {
            var overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'display:flex; z-index:99990;';
            overlay.id = 'statsDashboard';
            overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

            var card = document.createElement('div');
            card.className = 'modal-card';
            card.style.cssText = 'width:600px; max-width:95%; max-height:85vh; overflow-y:auto;';
            card.onclick = function(e) { e.stopPropagation(); };

            var title = document.createElement('div');
            title.className = 'modal-title';
            title.textContent = '学习统计';
            card.appendChild(title);

            var loading = document.createElement('p');
            loading.style.cssText = 'text-align:center; padding:20px;';
            loading.textContent = '加载中...';
            card.appendChild(loading);

            var closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-secondary';
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = 'display:block; margin:15px auto 0;';
            closeBtn.onclick = function() { overlay.remove(); };
            card.appendChild(closeBtn);

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            try {
                var dailyRes = await API.stats.daily();
                var statsRes = await API.stats.getAll();
                var daily = dailyRes.daily || [];
                var stats = statsRes.stats || [];
                var totalCorrect = stats.reduce(function(s, w) { return s + w.correct; }, 0);
                var totalWrong = stats.reduce(function(s, w) { return s + w.wrong; }, 0);
                var totalWords = stats.length;
                var masteredWords = stats.filter(function(w) { return w.correct >= 3 && w.wrong === 0; }).length;
                var today = new Date().toISOString().slice(0, 10);
                var todayStats = daily.find(function(d) { return d.date === today; }) || { words_practiced: 0, correct_count: 0, wrong_count: 0 };
                var streak = 0;
                for (var i = daily.length - 1; i >= 0; i--) {
                    if (daily[i].words_practiced > 0) streak++;
                    else if (daily[i].date < today) break;
                }

                var html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:15px 0;">';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#007BFF;">' + totalWords + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">练习单词</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#28a745;">' + masteredWords + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">已掌握</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold; color:#ffc107;">' + streak + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">连续打卡</div></div>';
                html += '<div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:14px; text-align:center;"><div style="font-size:28px; font-weight:bold;">' + todayStats.words_practiced + '</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">今日练习</div></div>';
                html += '</div>';
                html += '<div style="margin:10px 0;">正确: ' + totalCorrect + ' | 错误: ' + totalWrong + ' | 正确率: ' + (totalCorrect + totalWrong > 0 ? Math.round(totalCorrect / (totalCorrect + totalWrong) * 100) : 0) + '%</div>';

                if (daily.length > 0) {
                    html += '<div style="margin-top:15px; padding-top:15px; border-top:1px solid var(--border-color);"><strong>近7天练习</strong></div><div style="margin-top:5px;">';
                    var last7 = daily.slice(-7).reverse();
                    last7.forEach(function(d) {
                        var barW = Math.min(100, d.words_practiced * 5);
                        html += '<div style="display:flex; align-items:center; gap:8px; margin:4px 0; font-size:13px;">';
                        html += '<span style="width:80px; color:var(--text-secondary);">' + d.date.slice(5) + '</span>';
                        html += '<div style="flex:1; background:var(--border-color); border-radius:4px; height:16px;"><div style="background:linear-gradient(90deg,#28a745,#007BFF); height:16px; border-radius:4px; width:' + barW + '%;"></div></div>';
                        html += '<span style="width:40px; text-align:right;">' + d.words_practiced + '</span></div>';
                    });
                    html += '</div>';
                }
                loading.innerHTML = html;
            } catch(e) {
                loading.innerHTML = '<p style="text-align:center; color:#dc3545;">加载失败: ' + e.message + '</p>';
            }
        }

        async function hardReset() {
            if (await showConfirm('确定要清除所有缓存并强制刷新吗？\n这将清除本地的学习进度。', '清除刷新', '取消', true)) {
                localStorage.clear();
                window.location.reload(true);
            }
        }
