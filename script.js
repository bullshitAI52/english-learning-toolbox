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

