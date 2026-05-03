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
                        const msg = data.message || (data.data ? Object.values(data.data)[0]?.message : null) || 'Request failed';
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
            if (audioContext.state === 'suspended') audioContext.resume();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
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
            }
        };

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
                reviewWordList = [];
                try {
                    var stats = WordStats.data;
                    var now = Date.now();
                    var threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
                    Object.keys(stats).forEach(function(w) {
                        if (stats[w].lastPracticed && stats[w].lastPracticed < threeDaysAgo && (stats[w].correct < 3 || stats[w].wrong > 0)) {
                            reviewWordList.push(w);
                        }
                    });
                } catch(e) {}
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
            currentPage = page;
            DataPersistence.savePage(page);
            const start = (page - 1) * WORDS_PER_PAGE;

            if (displayData.length === 0) {
                document.getElementById('wordList').innerHTML = '<div style="text-align:center; padding: 20px; color: #666;">当前模式下没有单词哦</div>';
                return;
            }

            const words = displayData.slice(start, start + WORDS_PER_PAGE);
            document.getElementById('wordList').innerHTML = words.map(function(word, index) {
                const stats = WordStats.get(word.english);
                return '<div class="word-item">' +
                    '<div class="chinese-text">' + word.chinese + '</div>' +
                    '<div class="word-stats">' +
                        '<span class="stat-badge correct">' + stats.correct + '</span>' +
                        '<span class="stat-badge wrong">' + stats.wrong + '</span>' +
                        (stats.correct >= 3 && stats.wrong === 0 ? '<span class="stat-badge" style="background:#d4edda; color:#155724;">已背熟</span>' : '') +
                    '</div>' +
                    '<div class="input-container">' +
                        '<input type="text" class="input-box" placeholder="请输入英文单词..." oninput="checkSpelling(this, \'' + word.english.replace(/'/g, "\\'") + '\', this.nextElementSibling)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
                        '<span class="check-icon"></span>' +
                    '</div>' +
                    '<div class="action-buttons">' +
                        '<button class="btn-icon btn-sound" onclick="playSound(\'' + word.english.replace(/'/g, "\\'") + '\')" title="播放发音">发音</button>' +
                        '<button class="btn-icon btn-spell" onclick="showSpelling(\'' + word.english.replace(/'/g, "\\'") + '\')" title="拼写示范">拼写</button>' +
                    '</div>' +
                '</div>';
            }).join('');
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
