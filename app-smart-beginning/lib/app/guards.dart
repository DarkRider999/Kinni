// Pure navigation-guard logic (SPEC §4.2). Deliberately free of Flutter and
// go_router imports so it is unit-testable in isolation and cannot drift from
// the UI layer.

/// Route prefix that requires an elevated parent session.
const String parentPathPrefix = '/parent';

/// The gate route a blocked navigation is sent to.
const String parentGatePath = '/parent-gate';

/// Returns the path to redirect to, or `null` to allow the navigation.
///
/// [location] is the target route path; [parentElevated] is whether a valid
/// parent session is currently active. The gate route itself is never blocked.
String? parentGuardRedirect({
  required String location,
  required bool parentElevated,
}) {
  if (location == parentGatePath || location.startsWith('$parentGatePath?')) {
    return null;
  }
  final bool isParentRoute = location == parentPathPrefix ||
      location.startsWith('$parentPathPrefix/');
  if (isParentRoute && !parentElevated) {
    return '$parentGatePath?redirect=${Uri.encodeComponent(location)}';
  }
  return null;
}
