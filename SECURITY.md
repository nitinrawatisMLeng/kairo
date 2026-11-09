# Security policy

## Supported versions

Only the latest release of Kairo gets security fixes. Kairo doesn't update itself, so if you are on an older one, install the latest first and check whether the problem is still there.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub: go to the [Security tab](https://github.com/nitinrawatisMLeng/kairo/security/advisories/new) and choose **Report a vulnerability**. Only the maintainer can see the report.

Please include:

- What the problem is and what an attacker could do with it.
- The steps to reproduce it, or a small proof of concept.
- Your Kairo version and Windows version.

This is a one-person project, so replies are best effort. You should hear back within about a week. Once a fix is released, the advisory is published and you are credited, unless you would rather stay anonymous.

## What counts

Kairo runs on your machine, hides the Windows taskbar, installs itself, and reads calendars. These are the areas where a bug matters most:

- The installer and uninstaller.
- Anything that lets a web page, calendar entry, file or dropped text run code or read files it should not.
- Calendar passwords and links, which are stored in Windows Credential Manager, and anything that leaks them into `settings.json`, logs or diagnostics.
- Settings import and export, and the files Kairo writes in `%APPDATA%\com.kairo.desktop`.
- Privilege problems with the all-users install.

Bugs that need an attacker who already has full control of your account, or issues in Windows itself, are out of scope.

## Dependencies

Kairo depends on Rust crates and npm packages. If you find a vulnerable dependency that affects Kairo, report it the same way.
