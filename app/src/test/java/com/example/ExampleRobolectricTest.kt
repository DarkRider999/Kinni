package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.model.BabyWeekDatabase
import com.example.data.model.UserProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("Kinni", appName)
  }

  @Test
  fun `verify water intake progress calculation`() {
    val userProfile = UserProfile(
      motherName = "Anjali",
      babyNickname = "Kinni",
      currentWeek = 30,
      currentDay = 3,
      dueDateYear = 2026,
      dueDateMonth = "October",
      dueDateDay = 29,
      daysLeft = 67,
      waterGoal = 8
    )

    val currentCups = 6
    val progressFraction = (currentCups.toFloat() / userProfile.waterGoal.toFloat()).coerceIn(0f, 1f)
    val percentage = (progressFraction * 100).toInt()
    val volumeMl = currentCups * 250

    assertEquals(0.75f, progressFraction, 0.001f)
    assertEquals(75, percentage)
    assertEquals(1500, volumeMl)
  }

  @Test
  fun `verify baby week database retrieval`() {
    val week30Info = BabyWeekDatabase.getInfoForWeek(30)
    assertNotNull(week30Info)
    assertEquals(30, week30Info.week)
    assertTrue(week30Info.fruit.isNotEmpty())
    assertTrue(week30Info.checklist.isNotEmpty())
  }
}

