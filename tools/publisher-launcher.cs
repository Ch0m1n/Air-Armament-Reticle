using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class PublisherLauncher {
    [STAThread]
    private static int Main(string[] args) {
        bool check = args.Length == 1 && args[0] == "--check";
        try {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string script = Path.Combine(root, "tools", "data-publisher.ps1");
            if (!File.Exists(script)) throw new FileNotFoundException("Keep Data-Publisher.exe beside the tools and src folders.");
            string pwsh = FindPowerShell();
            if (pwsh == null) throw new FileNotFoundException("PowerShell 7 is required. Install PowerShell 7 and try again.");
            if (check) return 0;
            ProcessStartInfo start = new ProcessStartInfo(pwsh);
            start.Arguments = "-NoLogo -NoProfile -STA -WindowStyle Hidden -File \"" + script + "\"";
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            using (Process child = Process.Start(start)) { }
            return 0;
        } catch (Exception error) {
            if (!check) MessageBox.Show(error.Message, "Data Publisher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
    private static string FindPowerShell() {
        string installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PowerShell", "7", "pwsh.exe");
        if (File.Exists(installed)) return installed;
        foreach (string folder in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)) {
            try { string candidate = Path.Combine(folder.Trim('"'), "pwsh.exe"); if (File.Exists(candidate)) return candidate; }
            catch (ArgumentException) { }
        }
        return null;
    }
}
