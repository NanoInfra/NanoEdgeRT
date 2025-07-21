interface ServiceInfo {
  config: { name: string; jwt_check?: boolean };
  status: string;
  port?: number | null;
}

export async function generateAdminUI(services: ServiceInfo[], jwtSecret: string): Promise<string> {
  const servicesJson = JSON.stringify(services.map((s) => ({
    name: s.config.name,
    status: s.status,
    port: s.port,
    jwt_check: s.config.jwt_check,
  })));

  // Generate a properly signed JWT token using Web Crypto API
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: "admin",
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    iat: Math.floor(Date.now() / 1000),
    iss: "nanoedgert-admin",
  };

  // Create JWT using proper HMAC-SHA256
  const encoder = new TextEncoder();

  // Helper function for base64url encoding
  function base64urlEncode(str: string): string {
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  // Convert signature to base64url
  const signatureArray = new Uint8Array(signature);
  let binaryString = "";
  for (let i = 0; i < signatureArray.length; i++) {
    binaryString += String.fromCharCode(signatureArray[i]);
  }
  const signatureB64 = base64urlEncode(binaryString);
  const token = `${headerB64}.${payloadB64}.${signatureB64}`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NanoEdgeRT Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f8fafc;
            --bg-tertiary: #f1f5f9;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --border-color: #e2e8f0;
            --accent-color: #0070f3;
            --accent-hover: #0051a2;
            --success-color: #22c55e;
            --success-bg: #dcfce7;
            --error-color: #ef4444;
            --error-bg: #fef2f2;
            --card-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
            --card-shadow-hover: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        [data-theme="dark"] {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #cbd5e1;
            --text-muted: #94a3b8;
            --border-color: #334155;
            --accent-color: #0070f3;
            --accent-hover: #0051a2;
            --success-color: #22c55e;
            --success-bg: rgba(34, 197, 94, 0.1);
            --error-color: #ef4444;
            --error-bg: rgba(239, 68, 68, 0.1);
            --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            --card-shadow-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            padding: 2rem 0;
            border-bottom: 1px solid var(--border-color);
        }

        .header-left {
            text-align: left;
        }

        .logo {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(45deg, var(--accent-color), #ff0080);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .logo-icon {
            font-size: 2rem;
            filter: none;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            font-weight: 400;
        }

        .theme-toggle {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.5rem;
            cursor: pointer;
            font-size: 1.2rem;
            transition: all 0.2s ease;
            color: var(--text-primary);
        }

        .theme-toggle:hover {
            border-color: var(--accent-color);
            transform: translateY(-1px);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            transition: all 0.3s ease;
            box-shadow: var(--card-shadow);
        }

        .stat-card:hover {
            border-color: var(--accent-color);
            transform: translateY(-2px);
            box-shadow: var(--card-shadow-hover);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent-color);
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .services-section {
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: var(--text-primary);
        }

        .services-grid {
            display: grid;
            gap: 1rem;
        }

        .service-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            transition: all 0.3s ease;
            box-shadow: var(--card-shadow);
        }

        .service-card:hover {
            border-color: var(--accent-color);
            transform: translateY(-1px);
            box-shadow: var(--card-shadow-hover);
        }

        .service-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .service-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .service-status {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-running {
            background: var(--success-bg);
            color: var(--success-color);
            border: 1px solid var(--success-color);
        }

        .status-stopped {
            background: var(--error-bg);
            color: var(--error-color);
            border: 1px solid var(--error-color);
        }

        .service-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .detail-item {
            display: flex;
            flex-direction: column;
        }

        .detail-label {
            color: var(--text-muted);
            font-size: 0.8rem;
            margin-bottom: 0.25rem;
        }

        .detail-value {
            color: var(--text-primary);
            font-weight: 500;
        }

        .service-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
        }

        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-primary {
            background: var(--accent-color);
            color: white;
        }

        .btn-primary:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background: var(--bg-secondary);
            border-color: var(--accent-color);
        }

        .btn-danger {
            background: var(--error-color);
            color: white;
        }

        .btn-danger:hover {
            background: #dc2626;
            transform: translateY(-1px);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .loading {
            opacity: 0.7;
            pointer-events: none;
        }

        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }

        .toast.show {
            transform: translateX(0);
        }

        .toast.success {
            background: var(--success-color);
        }

        .toast.error {
            background: var(--error-color);
        }

        .footer {
            text-align: center;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
            color: var(--text-muted);
        }

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .header {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }

            .service-details {
                grid-template-columns: 1fr;
            }

            .service-actions {
                flex-direction: column;
            }

            .logo {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-left">
                <div class="logo">
                    NanoEdgeRT
                </div>
                <div class="subtitle">Edge Function Runtime Administration</div>
            </div>
            <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
                <span id="theme-icon">🌙</span>
            </button>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="total-services">0</div>
                <div class="stat-label">Total Services</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="running-services">0</div>
                <div class="stat-label">Running Services</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="system-uptime">Online</div>
                <div class="stat-label">System Status</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="ports-used">0</div>
                <div class="stat-label">Ports Used</div>
            </div>
        </div>

        <section class="services-section">
            <h2 class="section-title">Services</h2>
            <div class="services-grid" id="services-grid">
                <!-- Services will be populated by JavaScript -->
            </div>
        </section>

        <footer class="footer">
            <p>&copy; 2025 NanoEdgeRT. Built with ❤️ for the edge.</p>
        </footer>
    </div>

    <div id="toast" class="toast"></div>

    <script>
        const services = ${servicesJson};
        const authToken = '${token}';
        
        // Theme management
        function toggleTheme() {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }

        function updateThemeIcon(theme) {
            const icon = document.getElementById('theme-icon');
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = \`toast \${type} show\`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        function updateStats() {
            const totalServices = services.length;
            const runningServices = services.filter(s => s.status === 'running').length;
            const portsUsed = services.filter(s => s.status === 'running').length;

            document.getElementById('total-services').textContent = totalServices;
            document.getElementById('running-services').textContent = runningServices;
            document.getElementById('ports-used').textContent = portsUsed;
        }

        function renderServices() {
            const grid = document.getElementById('services-grid');
            grid.innerHTML = '';

            services.forEach(service => {
                const serviceCard = document.createElement('div');
                serviceCard.className = 'service-card';
                serviceCard.innerHTML = \`
                    <div class="service-header">
                        <div class="service-name">\${service.name}</div>
                        <div class="service-status \${service.status === 'running' ? 'status-running' : 'status-stopped'}">
                            \${service.status}
                        </div>
                    </div>
                    <div class="service-details">
                        <div class="detail-item">
                            <div class="detail-label">Port</div>
                            <div class="detail-value">\${service.port || 'N/A'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">JWT Auth</div>
                            <div class="detail-value">\${service.jwt_check ? 'Required' : 'Disabled'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Endpoint</div>
                            <div class="detail-value">
                                \${service.status === 'running' ? \`<a href="http://0.0.0.0:8000/\${service.name}" target="_blank" style="color: var(--accent-color);">/\${service.name}</a>\` : 'Offline'}
                            </div>
                        </div>
                    </div>
                    <div class="service-actions">
                        \${service.status === 'running' 
                            ? \`<button class="btn btn-danger" onclick="stopService('\${service.name}')">⏹️ Stop Service</button>\`
                            : \`<button class="btn btn-primary" onclick="startService('\${service.name}')">▶️ Start Service</button>\`
                        }
                        <a href="http://127.0.0.1:8000/docs" target="_blank" class="btn btn-secondary">📚 API Docs</a>
                    </div>
                \`;
                grid.appendChild(serviceCard);
            });
        }

        async function startService(serviceName) {
            try {
                const response = await fetch(\`/_admin/start/\${serviceName}\`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + authToken
                    }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showToast(\`Service \${serviceName} started successfully!\`, 'success');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(result.error || 'Failed to start service', 'error');
                }
            } catch (error) {
                showToast('Network error: ' + error.message, 'error');
            }
        }

        async function stopService(serviceName) {
            if (!confirm(\`Are you sure you want to stop service "\${serviceName}"?\`)) {
                return;
            }

            try {
                const response = await fetch(\`/_admin/stop/\${serviceName}\`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + authToken
                    }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showToast(\`Service \${serviceName} stopped successfully!\`, 'success');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(result.error || 'Failed to stop service', 'error');
                }
            } catch (error) {
                showToast('Network error: ' + error.message, 'error');
            }
        }

        // Initialize the page
        initTheme();
        updateStats();
        renderServices();

        // Auto-refresh every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>`;
}
