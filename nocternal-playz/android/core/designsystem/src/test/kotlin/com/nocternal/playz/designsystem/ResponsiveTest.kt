package com.nocternal.playz.designsystem

import org.junit.Assert.assertEquals
import org.junit.Test

class ResponsiveTest {
    @Test fun classifiesByAndroidsLargeScreenBreakpoints() {
        assertEquals(ScreenSize.COMPACT, Responsive.classify(360)) // typical phone
        assertEquals(ScreenSize.COMPACT, Responsive.classify(599))
        assertEquals(ScreenSize.MEDIUM, Responsive.classify(600)) // unfolded foldable
        assertEquals(ScreenSize.MEDIUM, Responsive.classify(839))
        assertEquals(ScreenSize.EXPANDED, Responsive.classify(840)) // tablet
        assertEquals(ScreenSize.EXPANDED, Responsive.classify(1280))
    }

    @Test fun gridColumnsGrowWithScreenSize() {
        assertEquals(2, Responsive.gridColumns(ScreenSize.COMPACT))
        assertEquals(3, Responsive.gridColumns(ScreenSize.MEDIUM))
        assertEquals(4, Responsive.gridColumns(ScreenSize.EXPANDED))
    }
}
