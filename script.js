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
        renderTextbookBar(); renderSchoolBar();
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
            try {
                const audio = new Audio(youdaoAPI + encodeURIComponent(word) + '&type=1');
                audio.play().catch(function(e) { console.log('Audio failed:', e); });
            } catch (e) { console.log('Audio error:', e); }
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
    var TEXTBOOK_BOOKS = {
        'g5a': { title: "PEP 五年级上册", units: [{ name: "Unit 1", start: 2, end: 11, csv: "old,老的；年纪大的\nyoung,年轻的；岁数不大的\nfunny,滑稽的；可笑的\nkind,体贴的；慈祥的；宽容的\nstrict,要求严格的；严厉的\npolite,有礼貌的；客气的\nhard-working,工作努力的；辛勤的\nhelpful,有用的；愿意帮忙的\nclever,聪明的；聪颖的\nshy,羞怯的；腼腆的\nknow,知道；了解\nour,我们的\nMs,女士\nwill,将要；会\nsometimes,有时；间或\nrobot,机器人\nhim,他（宾格）\nspeak,会说；会讲（语言）\nfinish,完成；做完" }, { name: "Unit 2", start: 12, end: 21, csv: "Monday,星期一\nTuesday,星期二\nWednesday,星期三\nThursday,星期四\nFriday,星期五\nSaturday,星期六\nSunday,星期日\nweekend,周末\nwash,洗\nwash my clothes,洗我的衣服\nwatch,看\nwatch TV,看电视\ndo,做；干\ndo homework,做作业\nread,看；读\nread books,看书\nplay,踢；玩；参加（体育运动）\nplay football,踢足球\ncooking,烹饪；烹调\noften,时常；常常\npark,公园\ntired,疲倦的；累的\nsport,体育运动\nplay sports,做体育运动\nshould,应该；应当\nevery,每一个；每个\nday,一天；一日\nschedule,工作计划；日程安排" }, { name: "Unit 3", start: 22, end: 35, csv: "sandwich,三明治\nsalad,蔬菜沙拉；混合沙拉\nhamburger,汉堡包\nice cream,冰淇淋\ntea,茶；茶水\nfresh,新鲜的；刚摘的\nhealthy,健康的\ndelicious,美味的；可口的\nhot,辣的；辛辣的\nsweet,含糖的；甜的\ndrink,喝；饮\nthirsty,渴的；口渴的\nfavourite,特别喜爱的\nfood,食物\ndear,亲爱的\nonion,洋葱；葱头" }, { name: "Unit 4", start: 36, end: 45, csv: "sing,唱；唱歌\nsong,歌曲\nsing English songs,唱英文歌曲\nplay the pipa,弹琵琶\nkung fu,功夫；武术\ndo kung fu,练功夫\ndance,跳舞\ndraw,画\ncartoon,漫画\ndraw cartoons,画漫画\ncook,烹调；烹饪\nswim,游泳\nplay basketball,打篮球\nping-pong,乒乓球\nplay ping-pong,打乒乓球\nspeak English,说英语\nwe'll,我们将\nparty,聚会；派对\nnext,下一个的；接下来的\nwonderful,极好的；了不起的\nlearn,学；学习；学会\nany,任何的；任一的\nproblem,问题\nno problem,没问题\nwant,要；想要\nsend,邮寄；发送\nemail,电子邮件\nat,（后面接邮件地址）" }, { name: "Unit 5", start: 46, end: 55, csv: "clock,时钟；钟\nplant,植物\nbottle,瓶子\nwater bottle,水瓶\nbike,自行车；脚踏车\nphoto,照片；相片\nfront,正面\nin front of,在……前面\nbetween,在……中间\nabove,在（或向）……上面\nbeside,在旁边（附近）\nbehind,在（或向）……后面\nthere,（表示存在或发生）\ngrandfather,祖父；外祖父\ntheir,他（她，它）们的\nhouse,房屋；房子；住宅\nlot,大量；许多\nlots of,大量；许多\nflower,花；花朵\nmove,搬家\ndirty,肮脏的\neverywhere,处处；到处\nmouse,老鼠\nlive,住；居住\nnature,自然界；大自然" }, { name: "Unit 6", start: 56, end: 65, csv: "forest,森林；林区\nriver,河；江\nlake,湖；湖泊\nmountain,高山；山岳\nhill,山丘；小山\ntree,树；树木；乔木\nbridge,桥\nbuilding,建筑物；房子；楼房\nvillage,村庄；村镇\nhouse,房屋；房子；住宅\nboating,划船\ngo boating,去划船\naren't,不是（are not）\nrabbit,兔；野兔\nhigh,高的" }] },
        'g5b': { title: "PEP 五年级下册", units: [{ name: "Unit 1", start: 2, end: 11, csv: "eat breakfast,吃早饭\nhave...class,上……课\nplay sports,进行体育运动\nexercise,活动；运动\ndo morning exercises,做早操\neat dinner,吃晚饭\nclean my room,打扫我的房间\ngo for a walk,散步\ngo shopping,去买东西；购物\ntake,学习；上（课）\ndancing,跳舞；舞蹈\ntake a dancing class,上舞蹈课\nwhen,什么时候；何时\nafter,在（时间）后\nstart,开始\nusually,通常地；惯常地\nSpain,西班牙\nlate,晚；迟\na.m.,午前；上午\np.m.,午后；下午\nwhy,为什么\nshop,去买东西；购物\nwork,工作\nlast,上一个的；刚过去的\nsound,听起来好像\nalso,还；也\nbusy,忙的\nneed,需要\nplay,戏剧；剧本\nletter,信\nlive,居住\nisland,岛\nalways,总是；一直\ncave,山洞；洞穴\ngo swimming,去游泳\nwin,获胜" }, { name: "Unit 2", start: 12, end: 21, csv: "spring,春天\nsummer,夏天\nautumn,秋天\nwinter,冬天\nseason,季节\npicnic,野餐\ngo on a picnic,去野餐\npick,摘；采集\npick apples,摘苹果\nsnowman,雪人\nmake a snowman,堆雪人\ngo swimming,去游泳\nwhich,哪一个\nbest,最；极\nsnow,雪\ngood job,做得好\nbecause,因为\nvacation,假期\nall,完全；全部\npink,粉色\nlovely,可爱的\nleaf,叶子\nfall,落下；跌落\npaint,绘画" }, { name: "Unit 3", start: 22, end: 35, csv: "January,一月\nFebruary,二月\nMarch,三月\nApril,四月\nMay,五月\nJune,六月\nJuly,七月\nAugust,八月\nSeptember,九月\nOctober,十月\nNovember,十一月\nDecember,十二月\nfew,不多；很少\na few,一些\nthing,事情\nmeet,集会；会面\nsports meet,运动会\nEaster,复活节\ntrip,旅行\nyear,年\nplant,种植\ncontest,比赛；竞赛\nthe Great Wall,长城\nnational,国家的\nNational Day,国庆日\nAmerican,美国的\nThanksgiving,感恩节\nChristmas,圣诞节\nholiday,假日；节日\ngame,游戏\nroll,滚动\nlook for,寻找\nchocolate,巧克力\nbunny,兔子\nRSVP,请赐复\nby,在……之前" }, { name: "Unit 4", start: 36, end: 45, csv: "first,第一（的）\nsecond,第二（的）\nthird,第三（的）\nfourth,第四（的）\nfifth,第五（的）\ntwelfth,第十二（的）\ntwentieth,第二十（的）\ntwenty-first,第二十一（的）\ntwenty-third,第二十三（的）\nthirtieth,第三十（的）\nspecial,特殊的；特别的\nfool,蠢人；傻瓜\nkitten,小猫\ndiary,日记\nstill,仍然\nnoise,噪音\nfur,动物皮毛\nopen,开着的\nwalk,行走" }, { name: "Unit 5", start: 46, end: 55, csv: "mine,我的\nyours,你（们）的\nhis,他的\nhers,她的\ntheirs,他（她，它）们的\nours,我们的\nclimbing,（正在）攀登；攀爬\neating,（正在）吃\nplaying,（正在）玩耍\njumping,（正在）跳\ndrinking,（正在）喝\nsleeping,（正在）睡觉\neach,每个；各个\nother,其他\neach other,互相\nexcited,兴奋的\nlike,像……那样" }, { name: "Unit 6", start: 56, end: 65, csv: "doing morning exercises,（正在）做早操\nhaving...class,（正在）上……课\neating lunch,（正在）吃午饭\nreading a book,（正在）看书\nlistening to music,（正在）听音乐\nkeep,保持\nkeep to the right,靠右\nkeep your desk clean,保持你的课桌干净\ntalk quietly,小声讲话\nturn,顺序\ntake turns,按顺序来\nbamboo,竹子\nits,它的\nshow,展示；给……看\nanything,任何事物\nelse,另外；其他\nexhibition,展览\nsay,说；讲\nhave a look,看一看\nsushi,寿司\nteach,教\nsure,当然\nCanadian,加拿大的\nSpanish,西班牙的" }] },
        'g6a': { title: "PEP 六年级上册", units: [{ name: "Unit 1", start: 2, end: 11, csv: "science,科学\nmuseum,博物馆\npost office,邮局\nbookstore,书店\ncinema,电影院\nhospital,医院\ncrossing,十字路口\nturn,转弯\nleft,左\nstraight,笔直地\nright,右\nask,问\nsir,先生\ninteresting,有趣的\nItalian,意大利的\nrestaurant,餐馆\npizza,比萨饼\nstreet,大街；街道\nget,到达\nBDS,北斗卫星导航系统\ngave,提供；交给\nfeature,特点\nfollow,跟着\nfar,远的\ntell,告诉" }, { name: "Unit 2", start: 12, end: 21, csv: "on foot,步行\nby,乘\nbus,公共汽车\nplane,飞机\ntaxi,出租汽车\nship,（大）船\nsubway,地铁\ntrain,火车\nslow,慢的\ndown,减少；降低\nslow down,慢下来\nstop,停下\nMrs,夫人\nearly,早到的\nhelmet,头盔\nmust,必须\nwear,穿；戴\nattention,注意\npay attention to,注意\ntraffic,交通\ntraffic lights,交通信号灯\nMunich,慕尼黑\nGermany,德国\nAlaska,阿拉斯加州\nsled,雪橇\nfast,快\nferry,轮渡\nPapa Westray,帕帕韦斯特雷岛\nScotland,苏格兰" }, { name: "Unit 3", start: 22, end: 35, csv: "visit,拜访\nfilm,电影\nsee a film,看电影\ntrip,旅行\ntake a trip,去旅行\nsupermarket,超市\nevening,晚上；傍晚\ntonight,在今晚\ntomorrow,明天\nnext week,下周\ndictionary,词典\ncomic,滑稽的\ncomic book,连环画册\nword,单词\nword book,单词书\npostcard,明信片\nlesson,课\nspace,太空\ntravel,（尤指长途）旅行\nhalf,一半\nprice,价格\nMid-Autumn Festival,中秋节\ntogether,一起\nget together,聚会\nmooncake,月饼\npoem,诗\nmoon,月亮" }, { name: "Unit 4", start: 36, end: 45, csv: "studies,学习\npuzzle,谜\nhiking,远足\npen pal,笔友\nhobby,业余爱好\njasmine,茉莉\nidea,想法；主意\nCanberra,堪培拉\namazing,令人惊奇的\nshall,表示征求意见\ngoal,射门\njoin,加入\nclub,俱乐部\nshare,分享" }, { name: "Unit 5", start: 46, end: 55, csv: "factory,工厂\nworker,工人\npostman,邮递员\nbusinessman,商人；企业家\npolice officer,警察\nfisherman,渔民\nscientist,科学家\npilot,飞行员\ncoach,教练\ncountry,国家\nhead teacher,校长\nsea,大海\nstay,保持\nuniversity,大学\ngym,体育馆\nif,如果\nreporter,记者\nuse,使用\ntype,打字\nquickly,迅速地\nsecretary,秘书" }, { name: "Unit 6", start: 56, end: 65, csv: "angry,生气的\nafraid,害怕\nsad,难过的\nworried,担心的；发愁的\nhappy,高兴的\nsee a doctor,看病\nwear,穿\nmore,更多的\ndeep,深的\nbreath,呼吸\ntake a deep breath,深深吸一口气\ncount,数数\ncount to ten,数到十\nchase,追赶\nmice,老鼠（mouse的复数）\nbad,邪恶的；坏的\nhurt,（使）受伤\nill,有病；不舒服\nwrong,有毛病\nshould,应该\nfeel,觉得；感到\nwell,健康；身体好\nsit,坐\ngrass,草坪\nhear,听见\nant,蚂蚁\nworry,担心；担忧\nstuck,陷住；无法移动\nmud,泥\npull,拉；拽\neveryone,每人" }] },
        'g6b': { title: "PEP 六年级下册", units: [{ name: "Unit 1", start: 2, end: 11, csv: "younger,更年轻的\nolder,更年长的\ntaller,更高的\nshorter,更矮的；更短的\nlonger,更长的\nthinner,更瘦的\nheavier,更重的\nbigger,更大的\nsmaller,更小的\nstronger,更强壮的\ndinosaur,恐龙\nhall,大厅\nmetre,米\nthan,比\nboth,两个都\nkilogram,千克；公斤\ncountryside,乡村\nlower,更低地\nshadow,阴影；影子\nsmarter,更聪明的\nbecome,开始变得；变成" }, { name: "Unit 2", start: 12, end: 21, csv: "cleaned,打扫\nstayed,停留；待\nwashed,洗\nwatched,看\nhad,患病；得病\nhad a cold,感冒\nslept,睡觉\nread,读\nsaw,看见\nlast,最近的；上一个的\nyesterday,昨天\nbefore,在……之前\ndrank,喝\nshow,演出\nmagazine,杂志\nbetter,更好的\nfaster,更快的\nhotel,旅馆\nfixed,修理\nbroken,破损的\nlamp,台灯\nloud,喧闹的；大声的\nenjoy,享受……乐趣；喜爱\nstay,暂住；逗留" }, { name: "Unit 3", start: 22, end: 31, csv: "went,去\ncamp,野营\nwent camping,野营\nfish,钓鱼；捕鱼\nwent fishing,去钓鱼\nrode,骑（马；自行车）\nhurt,（使）受伤\nate,吃\ntook,拍照\ntook pictures,照相\nbought,买\ngift,礼物\nfell,摔倒\noff,从（某处）落下\nLabour Day,劳动节\nmule,骡子\nTurpan,吐鲁番\ncould,能\ntill,直到\nbeach,海滩；沙滩\nbasket,篮；筐\npart,角色\nlicked,舔\nlaughed,笑" }, { name: "Unit 4", start: 32, end: 41, csv: "dining hall,饭厅\ngrass,草坪\ngym,体育馆\nago,以前\ncycling,骑自行车运动\ngo cycling,去骑自行车\nice-skate,滑冰\nbadminton,羽毛球运动\nstar,星\neasy,容易的\nlook up,查阅\nInternet,互联网\ndifferent,不同的\nactive,积极的；活跃的\nrace,赛跑\nnothing,没有什么\nthought,想\nfelt,感觉\ncheetah,猎豹\ntrip,绊倒\nwoke,醒\ndream,梦" }] }
    };
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
    function renderTextbookBar() {
        var bar = document.getElementById('textbookBar');
        if (!bar || typeof TEXTBOOK_BOOKS === 'undefined') return;
        var html = '';
        TEXTBOOK_STAGES.forEach(function(g) {
            html += '<span class="textbook-label">📚 教材词库 · ' + g.stage + '</span>';
            g.books.forEach(function(it) {
                var b = TEXTBOOK_BOOKS[it.key];
                if (!b) return;
                html += '<button class="tb-btn" onclick="loadTextbook(\'' + it.key + '\')">' + it.short + '<span class="tb-sub">' + b.title.replace('PEP ', '') + ' · ' + bookCount(it.key) + '词</span></button>';
            });
        });
        bar.innerHTML = html;
    }
    var currentTextbook = null;
    function loadTextbook(key) {
        var b = TEXTBOOK_BOOKS[key];
        if (!b) return;
        currentTextbook = key;
        renderUnitBar();
        parseCSVData(mergeUnitCSVs(b.units), b.title + '.csv');
    }
    function loadUnit(idx) {
        if (!currentTextbook) return;
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var u = b.units[idx];
        if (!u) return;
        parseCSVData(u.csv, b.title + ' ' + u.name + '.csv');
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
    }
    function renderUnitBar() {
        var bar = document.getElementById('unitBar');
        if (!bar) return;
        if (!currentTextbook) { bar.innerHTML = ''; return; }
        var b = TEXTBOOK_BOOKS[currentTextbook];
        var html = '<span class="textbook-label">' + b.title.replace('PEP ', '') + ' · 按单元背</span>';
        html += '<button class="tb-btn unit-btn" onclick="loadTextbook(\'' + currentTextbook + '\')">整册<span class="tb-sub">' + bookCount(currentTextbook) + '词</span></button>';
        b.units.forEach(function(u, i) {
            var n = u.csv.split('\n').filter(function(x) { return x.trim(); }).length;
            html += '<button class="tb-btn unit-btn" onclick="loadUnit(' + i + ')">' + u.name + '<span class="tb-sub">第' + u.start + '–' + u.end + '页 · ' + n + '词</span></button>';
        });
        html += '<div class="page-row"><span>按页数背：第</span><input type="number" id="pageFrom" class="page-input" min="1" placeholder="' + b.units[0].start + '"><span>页到第</span><input type="number" id="pageTo" class="page-input" min="1" placeholder="' + b.units[b.units.length - 1].end + '"><span>页</span><button class="btn btn-primary page-go" onclick="loadByPages()">按页数背</button></div>';
        bar.innerHTML = html;
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
    function openDiyModal() { initSchoolPicker(); initDiyPicker(); renderDiyWords(); renderDiySents(); document.getElementById('diyModal').style.display = 'flex'; }
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
        b.units.forEach(function(u, i) { html += '<option value="' + i + '">' + u.name + '（第' + u.start + '–' + u.end + '页）</option>'; });
        document.getElementById('diyUnitSel').innerHTML = html;
    }
    function renderPicker() {
        var key = document.getElementById('diyBookSel').value;
        if (key !== diyLastBook) { diyLastBook = key; renderUnitSel(); }
        var b = TEXTBOOK_BOOKS[key];
        var ui = parseInt(document.getElementById('diyUnitSel').value, 10);
        var csv = ui >= 0 ? b.units[ui].csv : mergeUnitCSVs(b.units);
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
    function schoolUnits() {
        var p = SchoolStore.get();
        if (!p || !TEXTBOOK_BOOKS[p.book]) return null;
        var b = TEXTBOOK_BOOKS[p.book];
        var last = Math.min(p.unit, b.units.length - 1);
        return { book: p.book, title: b.title, last: last, units: b.units.slice(0, last + 1) };
    }
    function renderSchoolBar() {
        var bar = document.getElementById('schoolBar');
        if (!bar) return;
        var sc = schoolUnits();
        if (!sc) {
        bar.innerHTML = '<span class="sb-title">🏫 学校进度</span><span>还没设置，设置后可一键背学校学过的内容</span><button class="btn btn-primary" onclick="openDiyModal()">去设置</button>';
        return;
        }
        var n = mergeUnitCSVs(sc.units).split('\n').length;
        bar.innerHTML = '<span class="sb-title">🏫 学校进度：' + sc.title.replace('PEP ', '') + ' · 学到 ' + TEXTBOOK_BOOKS[sc.book].units[sc.last].name + '</span><button class="btn btn-primary" onclick="loadSchoolWords()">▶️ 背学过的内容（Unit 1–' + (sc.last + 1) + ' · ' + n + '词）</button>';
    }
    function loadSchoolWords() {
        var sc = schoolUnits();
        if (!sc) { openDiyModal(); return; }
        closeDiyModal();
        currentTextbook = sc.book;
        renderUnitBar();
        parseCSVData(mergeUnitCSVs(sc.units), sc.title + ' 学校进度（Unit 1–' + (sc.last + 1) + '）.csv');
    }
    function addSchoolWordsToDiy() {
        var sc = schoolUnits();
        if (!sc) { alert('先在上面选好课本和学到的单元，点「保存进度」。'); return; }
        var list = DiyStore.words();
        var seen = {}; list.forEach(function(w) { seen[w.en.toLowerCase()] = 1; });
        var added = 0;
        mergeUnitCSVs(sc.units).split('\n').forEach(function(line) {
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
        SchoolStore.set({ book: book, unit: unit });
        renderSchoolBar();
        alert('学校进度已保存：' + TEXTBOOK_BOOKS[book].title + ' · 学到 ' + TEXTBOOK_BOOKS[book].units[unit].name + '。');
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
        var t = null, ta = 0, tc = 0, tw = 0;
        rows.forEach(function(r) { ta += r.a; tc += r.c; tw += r.w; if (r.date === tk) t = r; });
        var html = '';
        if (t) {
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
