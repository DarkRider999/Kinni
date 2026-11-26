# QA checklist — Anjali CRM AI

Mark each item only after testing on a real Android device and recording the device/OS/build.

## Build and launch
- [ ] `flutter pub get` completes successfully
- [ ] `flutter analyze` reviewed; no release-blocking issues
- [ ] Debug APK builds and installs
- [ ] Release APK builds with production signing
- [ ] AAB builds and passes Play Console validation
- [ ] Cold launch, background/resume, and force-stop/relaunch work
- [ ] App icon, app name, package name and version are correct

## Current implemented features
- [ ] Dashboard counts reflect local database contents
- [ ] Create contact with required name
- [ ] Search contacts by name/company/phone/email
- [ ] Edit contact and verify persistence after restart
- [ ] Delete contact and confirm activity references are cleared
- [ ] Create activity with and without due date
- [ ] Complete/reopen activity and verify persistence
- [ ] Light and dark/system theme appearance reviewed
- [ ] Biometric capability check behaves correctly on supported and unsupported devices

## Required product features not implemented in this package
- [ ] PIN creation, secure storage, lockout and app-wide lock
- [ ] Contacts import permission flow and contact picker
- [ ] WhatsApp open/deep link workflow
- [ ] Excel export and content validation
- [ ] PDF export and content validation
- [ ] Notification permission and scheduled notification delivery
- [ ] Firebase authentication, security rules, sync conflict handling and offline queue
- [ ] Offline/online reconciliation and retry behavior
- [ ] Backup, restore, integrity checks and encryption
- [ ] Location, camera, microphone, phone/call-log functionality if retained
- [ ] Responsive layout across phone/tablet sizes
- [ ] Accessibility labels, text scaling and screen reader checks
- [ ] Privacy policy and permission disclosures
- [ ] R8/minified release smoke test
- [ ] Upgrade test from prior version and database migration test

## Release sign-off
- [ ] No test data or secrets in release
- [ ] Keystore backed up securely
- [ ] Final APK/AAB hashes recorded
- [ ] Product owner approval documented
