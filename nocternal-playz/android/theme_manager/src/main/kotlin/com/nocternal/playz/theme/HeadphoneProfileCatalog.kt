package com.nocternal.playz.theme

import com.nocternal.playz.model.HeadphoneProfile

/**
 * Headphone Profiles (spec #12): six built-in brand profiles, each a pointer to an existing
 * [EqPresets] curve chosen for that brand's known house sound - no new EQ data, no new DSP.
 */
object HeadphoneProfileCatalog {
    val SONY = HeadphoneProfile(id = "hp_sony", name = "Sony", eqPresetId = EqPresets.EDM_PUNCH.id)
    val BOSE = HeadphoneProfile(id = "hp_bose", name = "Bose", eqPresetId = EqPresets.WARM_MIDS.id)
    val SENNHEISER = HeadphoneProfile(id = "hp_sennheiser", name = "Sennheiser", eqPresetId = EqPresets.CLASSICAL.id)
    val JBL = HeadphoneProfile(id = "hp_jbl", name = "JBL", eqPresetId = EqPresets.HIP_HOP.id)
    val AIRPODS = HeadphoneProfile(id = "hp_airpods", name = "AirPods", eqPresetId = EqPresets.VOCAL_CLARITY.id)
    val GALAXY_BUDS = HeadphoneProfile(id = "hp_galaxy_buds", name = "Galaxy Buds", eqPresetId = EqPresets.AIRY_HIGHS.id)

    val all: List<HeadphoneProfile> = listOf(SONY, BOSE, SENNHEISER, JBL, AIRPODS, GALAXY_BUDS)
}
