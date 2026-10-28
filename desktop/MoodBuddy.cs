// The mood buddy on the Windows desktop: a borderless, always-on-top window whose
// WebView2 draws whatever the mod last wrote to %USERPROFILE%\.claude\mood-buddy\state.json.
// Built with the C# compiler that ships with .NET Framework (C# 5), see build.cmd.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main()
    {
        bool isFirst;
        using (new Mutex(true, "mood-buddy-desktop", out isFirst))
        {
            if (!isFirst) return;
            // Physical pixels everywhere, so the window, the page and the mouse hook agree.
            SetProcessDPIAware();
            Application.EnableVisualStyles();
            Application.Run(new BuddyForm());
        }
    }
}

class BuddyForm : Form
{
    const int BaseWidth = 220;
    const int BaseHeight = 280;
    const int BaseGap = 24;
    // Painted where the page is transparent, then keyed out of the window.
    static readonly Color Key = Color.FromArgb(255, 1, 254, 1);

    static readonly string StateDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "mood-buddy");
    static readonly string StateFile = Path.Combine(StateDir, "state.json");
    static readonly string PlaceFile = Path.Combine(StateDir, "window.txt");
    // "/buddy desktop off" writes {"action":"quit","at":<ms>} here; a request older than this window is ignored.
    static readonly string ControlFile = Path.Combine(StateDir, "control.json");
    static readonly long StartedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    static readonly string AppDir = AppDomain.CurrentDomain.BaseDirectory;

    readonly WebView2 view = new WebView2();
    readonly System.Windows.Forms.Timer poll = new System.Windows.Forms.Timer();
    readonly float scale;
    FileSystemWatcher watcher;
    string lastText = "";
    bool isReady;

    // The keyed-out window lets every click through, the cat included (the page is
    // drawn on a layer Windows doesn't hit-test), so a mouse hook catches presses
    // on the parts the page says are drawn.
    readonly List<RectangleF> hitAreas = new List<RectangleF>();
    float pageScale = 1;
    LowLevelMouseProc hookProc;
    IntPtr hook = IntPtr.Zero;
    bool isDragging;
    Point dragOffset;
    bool isMenuOpen;

    delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    struct MouseHookInfo
    {
        public Point pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr extraInfo;
    }

    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc fn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
    const int WH_MOUSE_LL = 14;
    const int WM_MOUSEMOVE = 0x0200;
    const int WM_LBUTTONDOWN = 0x0201;
    const int WM_LBUTTONUP = 0x0202;
    const int WM_RBUTTONDOWN = 0x0204;
    const int WM_RBUTTONUP = 0x0205;

    public BuddyForm()
    {
        using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) scale = g.DpiX / 96f;

        Text = "Mood Buddy";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        Size = new Size(Scaled(BaseWidth), Scaled(BaseHeight));
        Location = StartLocation();
        BackColor = Key;
        TransparencyKey = Key;

        view.Dock = DockStyle.Fill;
        view.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(view);

        Load += async delegate
        {
            try
            {
                // Keep the browser's profile out of the app folder, which may be synced.
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(StateDir, "webview2"));
                await view.EnsureCoreWebView2Async(env);
            }
            catch (Exception error)
            {
                MessageBox.Show("Mood Buddy needs the Microsoft Edge WebView2 Runtime.\n\n" + error.Message, "Mood Buddy");
                Close();
                return;
            }
            var web = view.CoreWebView2;
            web.Settings.AreDefaultContextMenusEnabled = false;
            web.Settings.AreDevToolsEnabled = false;
            web.Settings.IsStatusBarEnabled = false;
            web.Settings.IsZoomControlEnabled = false;
            web.SetVirtualHostNameToFolderMapping("buddy.local", AppDir, CoreWebView2HostResourceAccessKind.DenyCors);
            web.WebMessageReceived += OnPageMessage;
            web.NavigationCompleted += delegate { isReady = true; lastText = ""; Check(); };
            web.Navigate("https://buddy.local/index.html");
        };

        hookProc = OnMouse;
        using (Process self = Process.GetCurrentProcess())
        {
            hook = SetWindowsHookEx(WH_MOUSE_LL, hookProc, GetModuleHandle(self.MainModule.ModuleName), 0);
        }
        FormClosed += delegate { if (hook != IntPtr.Zero) UnhookWindowsHookEx(hook); };

        Directory.CreateDirectory(StateDir);
        watcher = new FileSystemWatcher(StateDir, "*.json");
        watcher.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName;
        watcher.Changed += delegate { BeginInvoke(new Action(Check)); };
        watcher.Created += delegate { BeginInvoke(new Action(Check)); };
        watcher.EnableRaisingEvents = true;
        // The watcher can miss a change, so a slow poll backs it up.
        poll.Interval = 1000;
        poll.Tick += delegate { Check(); };
        poll.Start();
    }

    int Scaled(int value)
    {
        return (int)Math.Round(value * scale);
    }

    // The mod rewrites the file whole; a read that lands mid-write is retried on the next check.
    void Check()
    {
        if (IsQuitRequested())
        {
            Close();
            return;
        }
        if (!isReady) return;
        string text;
        try { text = File.ReadAllText(StateFile); }
        catch { return; }
        if (text == lastText || !text.TrimEnd().EndsWith("}")) return;
        lastText = text;
        view.CoreWebView2.PostWebMessageAsString(text);
    }

    static bool IsQuitRequested()
    {
        try
        {
            var match = System.Text.RegularExpressions.Regex.Match(
                File.ReadAllText(ControlFile), "\"action\"\\s*:\\s*\"quit\"[^}]*\"at\"\\s*:\\s*(\\d+)");
            return match.Success && long.Parse(match.Groups[1].Value) > StartedAt;
        }
        catch
        {
            return false;
        }
    }

    // "hit:<page width>;x,y,w,h;..." in CSS pixels: where the cat and bubble are drawn.
    void OnPageMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string message = e.TryGetWebMessageAsString();
        if (message == null || !message.StartsWith("hit:")) return;
        string[] parts = message.Substring(4).Split(';');
        float pageWidth;
        if (!float.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out pageWidth) || pageWidth <= 0) return;
        pageScale = ClientSize.Width / pageWidth;
        hitAreas.Clear();
        for (int i = 1; i < parts.Length; i++)
        {
            string[] n = parts[i].Split(',');
            if (n.Length != 4) continue;
            float x, y, w, h;
            if (float.TryParse(n[0], NumberStyles.Float, CultureInfo.InvariantCulture, out x)
                && float.TryParse(n[1], NumberStyles.Float, CultureInfo.InvariantCulture, out y)
                && float.TryParse(n[2], NumberStyles.Float, CultureInfo.InvariantCulture, out w)
                && float.TryParse(n[3], NumberStyles.Float, CultureInfo.InvariantCulture, out h))
            {
                hitAreas.Add(new RectangleF(x, y, w, h));
            }
        }
    }

    bool IsOnBuddy(Point screen)
    {
        Point origin = PointToScreen(Point.Empty);
        foreach (RectangleF area in hitAreas)
        {
            var onScreen = new RectangleF(
                origin.X + area.X * pageScale, origin.Y + area.Y * pageScale,
                area.Width * pageScale, area.Height * pageScale);
            if (onScreen.Contains(screen)) return true;
        }
        return false;
    }

    // Runs on this thread for every mouse event on the machine, so it stays cheap and
    // passes on everything that isn't a press on the buddy.
    IntPtr OnMouse(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && !isMenuOpen && Visible)
        {
            var info = (MouseHookInfo)Marshal.PtrToStructure(lParam, typeof(MouseHookInfo));
            int message = wParam.ToInt32();
            if (isDragging)
            {
                if (message == WM_MOUSEMOVE)
                {
                    Location = new Point(info.pt.X - dragOffset.X, info.pt.Y - dragOffset.Y);
                }
                else if (message == WM_LBUTTONUP)
                {
                    isDragging = false;
                    SavePlace();
                    return (IntPtr)1;
                }
            }
            else if ((message == WM_LBUTTONDOWN || message == WM_RBUTTONDOWN || message == WM_RBUTTONUP) && IsOnBuddy(info.pt))
            {
                if (message == WM_LBUTTONDOWN)
                {
                    isDragging = true;
                    dragOffset = new Point(info.pt.X - Location.X, info.pt.Y - Location.Y);
                }
                else if (message == WM_RBUTTONUP)
                {
                    Point at = info.pt;
                    BeginInvoke(new Action(delegate { ShowMenu(at); }));
                }
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(hook, nCode, wParam, lParam);
    }

    void ShowMenu(Point at)
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Back to the corner", null, delegate { Location = CornerLocation(Size); SavePlace(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Close buddy", null, delegate { Close(); });
        menu.Opened += delegate { isMenuOpen = true; };
        menu.Closed += delegate { isMenuOpen = false; };
        menu.Show(at);
    }

    Point CornerLocation(Size size)
    {
        Rectangle area = Screen.PrimaryScreen.WorkingArea;
        return new Point(area.Right - size.Width - Scaled(BaseGap), area.Bottom - size.Height - Scaled(BaseGap));
    }

    // A remembered spot is used only while it is still on a screen.
    Point StartLocation()
    {
        try
        {
            string[] parts = File.ReadAllText(PlaceFile).Split(',');
            var place = new Point(int.Parse(parts[0]), int.Parse(parts[1]));
            foreach (Screen screen in Screen.AllScreens)
            {
                if (screen.WorkingArea.Contains(new Rectangle(place, Size))) return place;
            }
        }
        catch { }
        return CornerLocation(Size);
    }

    void SavePlace()
    {
        try { File.WriteAllText(PlaceFile, Location.X + "," + Location.Y); }
        catch { }
    }
}
