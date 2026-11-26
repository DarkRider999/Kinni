package com.anjali.crm.ai

import io.flutter.embedding.android.FlutterFragmentActivity

// local_auth (fingerprint / face unlock) needs a FragmentActivity host; with a
// plain FlutterActivity every authenticate() call fails with no_fragment_activity.
class MainActivity : FlutterFragmentActivity()
