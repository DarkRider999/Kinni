package com.subzero.messenger

import android.app.Application

/**
 * Application entry point. Kept deliberately thin — no analytics, no crash
 * reporter that ships content, no background sync of message data. A DI
 * container (Hilt) would be wired here in a fuller build.
 */
class SubZeroApp : Application()
