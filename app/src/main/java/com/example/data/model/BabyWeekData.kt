package com.example.data.model

data class BabyWeekInfo(
    val week: Int,
    val size: String,
    val weight: String,
    val animal: String,
    val emoji: String,
    val fruit: String,
    val fruitEmoji: String,
    val insight: String,
    val feature: String,
    val mamaTips: List<String>,
    val checklist: List<String>,
    val nutritionFocus: String,
    val nutritionBenefit: String,
    val foods: List<String>,
    val extraCalories: Int = 300,
    val proteinGrams: Int = 70,
    val calciumMg: Int = 1000,
    val ironMg: Int = 27
) {
    val trimester: Int
        get() = when {
            week <= 13 -> 1
            week <= 27 -> 2
            else -> 3
        }

    val progressPercent: Float
        get() = ((week.coerceIn(1, 40) - 1).toFloat() / 39f).coerceIn(0f, 1f)
}

object BabyWeekDatabase {
    private val weekMap: Map<Int, BabyWeekInfo> = mapOf(
        1 to BabyWeekInfo(
            week = 1,
            size = "0.1 mm",
            weight = "< 0.01 g",
            animal = "Tiny Pearl 🦪",
            emoji = "✨",
            fruit = "Poppy Seed",
            fruitEmoji = "🌱",
            insight = "Your journey begins! Your body is preparing for the miraculous path of conception.",
            feature = "A healthy uterine lining is preparing for implantation.",
            mamaTips = listOf("Start daily prenatal vitamins with folic acid", "Stay well-hydrated with clean water", "Prioritize sleep and gentle movement"),
            checklist = listOf("Start 400mcg Folic Acid daily", "Track your last menstrual period date", "Avoid alcohol, smoking, and excess caffeine"),
            nutritionFocus = "Folate & Multivitamin Foundation",
            nutritionBenefit = "Folate prevents neural tube defects from day one",
            foods = listOf("🥬 Spinach", "🍊 Oranges", "🥑 Avocado", "🌾 Fortified oats", "🫘 Chickpeas")
        ),
        2 to BabyWeekInfo(
            week = 2,
            size = "0.15 mm",
            weight = "< 0.01 g",
            animal = "Tiny Seed 🌱",
            emoji = "🌸",
            fruit = "Poppy Seed",
            fruitEmoji = "🌱",
            insight = "Ovulation and fertilization occur. The genetic blueprint is set!",
            feature = "All 46 chromosomes are joined to form a single unique cell.",
            mamaTips = listOf("Eat nutrient-dense whole foods", "Practice stress reduction and yoga", "Maintain a consistent sleep routine"),
            checklist = listOf("Continue taking prenatal vitamins", "Log basal body temperature if tracking", "Stay relaxed and positive"),
            nutritionFocus = "Zinc & Essential Minerals",
            nutritionBenefit = "Supports rapid cell division and hormonal balance",
            foods = listOf("🎃 Pumpkin seeds", "🥚 Pasture eggs", "🌾 Quinoa", "🥜 Walnuts")
        ),
        3 to BabyWeekInfo(
            week = 3,
            size = "0.2 mm",
            weight = "< 0.01 g",
            animal = "Microscopic Butterfly 🦋",
            emoji = "✨",
            fruit = "Vanilla Bean Seed",
            fruitEmoji = "✨",
            insight = "The blastocyst implants into the uterine lining.",
            feature = "The amniotic cavity and placenta begin to form.",
            mamaTips = listOf("Rest if you feel subtle fatigue", "Drink plenty of water", "Eat small, frequent meals"),
            checklist = listOf("Keep prenatal supplement routine", "Avoid raw or unpasteurized foods", "Stay calm and hydrated"),
            nutritionFocus = "Antioxidants & Vitamin C",
            nutritionBenefit = "Aids cellular protection and tissue bonding",
            foods = listOf("🍓 Strawberries", "🥝 Kiwi", "🥦 Broccoli", "🫑 Bell peppers")
        ),
        4 to BabyWeekInfo(
            week = 4,
            size = "1 mm",
            weight = "< 0.05 g",
            animal = "Ladybug 🐞",
            emoji = "🐞",
            fruit = "Poppy Seed",
            fruitEmoji = "🌱",
            insight = "The embryo is forming three distinct layers that will become organs, bones, and skin.",
            feature = "Positive home pregnancy test usually appears this week!",
            mamaTips = listOf("Celebrate the wonderful news!", "Schedule your first prenatal checkup", "Switch to gentle skincare"),
            checklist = listOf("Take a home pregnancy test", "Schedule appointment with OB/GYN", "Review current medications with doctor"),
            nutritionFocus = "B-Complex & Choline",
            nutritionBenefit = "Crucial for initial neural tube development",
            foods = listOf("🥚 Eggs", "🥦 Broccoli", "🥜 Sunflower seeds", "🥛 Milk / fortified soy")
        ),
        8 to BabyWeekInfo(
            week = 8,
            size = "1.6 cm",
            weight = "1.0 g",
            animal = "Hummingbird 🐦",
            emoji = "🐦",
            fruit = "Raspberry",
            fruitEmoji = "🫐",
            insight = "Baby's tiny heart is beating around 150-170 bpm—almost twice your rate!",
            feature = "Tiny webbed fingers and toes are starting to separate.",
            mamaTips = listOf("Combat morning sickness with ginger tea", "Eat crackers before getting out of bed", "Take short rests whenever fatigued"),
            checklist = listOf("First ultrasound scan preparation", "Stay hydrated with infused water", "Wear comfortable, non-restrictive bras"),
            nutritionFocus = "Vitamin B6 & Ginger for Nausea",
            nutritionBenefit = "Eases digestive discomfort while feeding cellular growth",
            foods = listOf("🍌 Bananas", "🍠 Sweet potatoes", "🥑 Avocado", "🫚 Fresh ginger")
        ),
        12 to BabyWeekInfo(
            week = 12,
            size = "5.4 cm",
            weight = "14 g",
            animal = "Baby Hamster 🐹",
            emoji = "🐹",
            fruit = "Lime",
            fruitEmoji = "🍋",
            insight = "Reflexes are developing! Baby can curl toes, clench fists, and make sucking motions.",
            feature = "Kidneys are producing urine, and fingernails are forming.",
            mamaTips = listOf("First trimester is wrapping up—nausea may start easing!", "Start moisturizing your growing belly", "Stay consistent with light walking"),
            checklist = listOf("Complete first trimester screening", "Plan when to share the joy with family", "Invest in comfortable stretchy clothing"),
            nutritionFocus = "Calcium & Phosphorus",
            nutritionBenefit = "Builds strong skeletal framework and tooth buds",
            foods = listOf("🧀 Greek yogurt", "🥛 Fortified milk", "🥬 Kale", "🌰 Almonds")
        ),
        16 to BabyWeekInfo(
            week = 16,
            size = "11.6 cm",
            weight = "100 g",
            animal = "Baby Hedgehog 🦔",
            emoji = "🦔",
            fruit = "Avocado",
            fruitEmoji = "🥑",
            insight = "Baby's eyes can make small side-to-side movements and sense light.",
            feature = "Baby can hear your voice and the sound of your heartbeat!",
            mamaTips = listOf("Talk and sing to your bump daily", "Notice subtle flutter kicks ('quickening')", "Sleep on your side with a support pillow"),
            checklist = listOf("Schedule the 20-week anatomy scan", "Check dental health (pregnancy gingivitis care)", "Look into prenatal yoga classes"),
            nutritionFocus = "Iron & Vitamin C pairing",
            nutritionBenefit = "Expands maternal blood volume and oxygen delivery",
            foods = listOf("🫘 Black beans", "🥬 Spinach", "🍊 Citrus fruits", "🥩 Lean meats / Tofu")
        ),
        20 to BabyWeekInfo(
            week = 20,
            size = "25.6 cm",
            weight = "300 g",
            animal = "Baby Bunny 🐰",
            emoji = "🐰",
            fruit = "Banana",
            fruitEmoji = "🍌",
            insight = "Halfway milestone! Baby is swallowing amniotic fluid and tasting what you eat.",
            feature = "Vernix caseosa is coating baby's delicate skin for protection.",
            mamaTips = listOf("Celebrate the halfway mark with a nice family photo", "Stay active with pelvic stretches", "Keep feet elevated when sitting"),
            checklist = listOf("Mid-pregnancy anatomy ultrasound", "Find out gender if you wish", "Start planning nursery space"),
            nutritionFocus = "Omega-3 DHA & Choline",
            nutritionBenefit = "Accelerates rapid brain and retinal wiring",
            foods = listOf("🍣 Cooked salmon", "🥚 Choline eggs", "🌰 Chia seeds", "🥑 Avocado")
        ),
        24 to BabyWeekInfo(
            week = 24,
            size = "30.0 cm",
            weight = "600 g",
            animal = "Baby Kitten 🐱",
            emoji = "🐱",
            fruit = "Corn on the Cob",
            fruitEmoji = "🌽",
            insight = "Baby's inner ear is fully formed, giving them a sense of balance and rhythm.",
            feature = "Baby can now respond to music, loud sounds, and gentle tummy pats!",
            mamaTips = listOf("Keep up with daily water intake (8+ glasses)", "Watch out for Braxton Hicks contractions", "Do gentle ankle rotations for swelling"),
            checklist = listOf("Schedule glucose screening test", "Sign up for childbirth education classes", "Research pediatrician options"),
            nutritionFocus = "Potassium & Magnesium",
            nutritionBenefit = "Prevents nighttime leg cramps and supports muscle tone",
            foods = listOf("🍌 Bananas", "🥔 Baked potatoes", "🥜 Pumpkin seeds", "🥬 Dark greens")
        ),
        28 to BabyWeekInfo(
            week = 28,
            size = "37.6 cm",
            weight = "1.0 kg",
            animal = "Baby Koala 🐨",
            emoji = "🐨",
            fruit = "Eggplant",
            fruitEmoji = "🍆",
            insight = "Welcome to the 3rd Trimester! Baby can open their eyes and blink.",
            feature = "Baby dreams during REM sleep and has regular sleep-wake cycles.",
            mamaTips = listOf("Start counting daily kicks in the evening", "Schedule visits every 2 weeks now", "Rest whenever your body asks"),
            checklist = listOf("Begin daily kick counts (aim for 10 kicks in 2h)", "Get Tdap vaccine if recommended", "Finalize nursery essentials"),
            nutritionFocus = "Protein & Vitamin K",
            nutritionBenefit = "Builds muscle tissue and blood clotting factors",
            foods = listOf("🥚 Eggs", "🫘 Lentils", "🧀 Cottage cheese", "🥦 Broccoli")
        ),
        30 to BabyWeekInfo(
            week = 30,
            size = "39.9 cm",
            weight = "1.3 kg",
            animal = "Baby Monkey 🐵",
            emoji = "🐵",
            fruit = "Cantaloupe",
            fruitEmoji = "🍈",
            insight = "Baby's vision is getting stronger! They can focus and respond to bright lights.",
            feature = "If you shine a torch on your bump, they might turn their head!",
            mamaTips = listOf(
                "Rest is becoming increasingly important - aim for 8 hours of quality sleep",
                "Keep walking for 30 minutes daily to maintain fitness for labor",
                "Practice deep breathing and relaxation techniques",
                "Monitor baby movements - should feel regular kicks and shifts"
            ),
            checklist = listOf(
                "Schedule 2-week prenatal appointments",
                "Discuss labor plan with healthcare provider",
                "Start pelvic floor exercises (Kegels)",
                "Pack hospital bag basics",
                "Arrange childcare if you have other children"
            ),
            nutritionFocus = "Protein & DHA Focus",
            nutritionBenefit = "Supports baby's brain development and vision",
            foods = listOf("🍣 Salmon", "🥚 Eggs", "🌾 Whole grains", "🥑 Avocado", "🫘 Lentils", "🥜 Almonds"),
            extraCalories = 300,
            proteinGrams = 70,
            calciumMg = 1000,
            ironMg = 27
        ),
        32 to BabyWeekInfo(
            week = 32,
            size = "42.4 cm",
            weight = "1.7 kg",
            animal = "Baby Duckling 🦆",
            emoji = "🦆",
            fruit = "Squash",
            fruitEmoji = "🎃",
            insight = "Baby is practicing breathing movements and sucking their thumb frequently.",
            feature = "All five senses are active and processing external stimuli.",
            mamaTips = listOf("Eat smaller meals more frequently to avoid heartburn", "Stay upright for 30 min after eating", "Sleep on your left side for optimal blood flow"),
            checklist = listOf("Install the infant car seat and get inspected", "Finalize hospital overnight bag", "Draft pediatrician contact info"),
            nutritionFocus = "Calcium & Vitamin D",
            nutritionBenefit = "Hardens bones while baby stores iron for postpartum",
            foods = listOf("🥛 Milk / Fortified milk", "🧀 Cheese", "🐟 Sardines/Salmon", "☀️ Safe sun / Vit D")
        ),
        34 to BabyWeekInfo(
            week = 34,
            size = "45.0 cm",
            weight = "2.1 kg",
            animal = "Baby Panda 🐼",
            emoji = "🐼",
            fruit = "Cantaloupe",
            fruitEmoji = "🍈",
            insight = "Baby's immune system is receiving antibodies from mom to protect against infections.",
            feature = "Fingernails have grown to the tips of baby's fingers!",
            mamaTips = listOf("Practice perineal massage if approved by OB", "Rest with elevated feet to ease swollen ankles", "Stay relaxed with calming music"),
            checklist = listOf("Tour the delivery hospital / birth center", "Review signs of true labor vs Braxton Hicks", "Wash newborn clothing and blankets"),
            nutritionFocus = "Hydration & Electrolytes",
            nutritionBenefit = "Maintains adequate amniotic fluid levels",
            foods = listOf("🥥 Coconut water", "🍉 Watermelon", "🥒 Cucumber", "💧 Mineral water")
        ),
        36 to BabyWeekInfo(
            week = 36,
            size = "47.4 cm",
            weight = "2.6 kg",
            animal = "Baby Lion Cub 🦁",
            emoji = "🦁",
            fruit = "Honeydew Melon",
            fruitEmoji = "🍈",
            insight = "Baby is gaining about 30 grams per day! Most babies are now head-down.",
            feature = "Baby drops lower into the pelvis ('lightening'), easing your breathing.",
            mamaTips = listOf("Prenatal appointments will now be weekly", "Keep hospital bag in the car trunk", "Practice labor breathing mantras"),
            checklist = listOf("Weekly prenatal appointment checks", "Group B Strep (GBS) swab test", "Finalize baby name shortlist!"),
            nutritionFocus = "Energy & Sustained Carbs",
            nutritionBenefit = "Builds endurance and stamina for approaching labor",
            foods = listOf("🌾 Oats", "🍌 Bananas", "🍠 Sweet potato", "🥜 Nut butter")
        ),
        38 to BabyWeekInfo(
            week = 38,
            size = "49.8 cm",
            weight = "3.1 kg",
            animal = "Baby Seal 🦭",
            emoji = "🦭",
            fruit = "Winter Melon",
            fruitEmoji = "🍉",
            insight = "Baby is considered full term! Lungs and vocal cords are ready to greet the world.",
            feature = "Baby has a firm grasp reflex and can hold onto mom's finger right after birth.",
            mamaTips = listOf("Rest as much as you can", "Track contractions with Kinni timer if they start", "Keep calm and stay confident"),
            checklist = listOf("Have car seat ready and adjusted", "Keep cell phone fully charged", "Ensure camera/charger is packed"),
            nutritionFocus = "Dates & Natural Labor Nutrition",
            nutritionBenefit = "Studies show 6 dates/day may support cervical ripening",
            foods = listOf("🌴 Medjool dates", "🍍 Fresh pineapple", "🍵 Red raspberry leaf tea", "💧 Plenty of water")
        ),
        40 to BabyWeekInfo(
            week = 40,
            size = "51.2 cm",
            weight = "3.5 kg",
            animal = "Sweet Newborn 👶",
            emoji = "👶",
            fruit = "Watermelon",
            fruitEmoji = "🍉",
            insight = "Due Date Week! Your little bundle of joy is fully ready to meet you.",
            feature = "Over 300 bones are present (some will fuse as baby grows).",
            mamaTips = listOf("Trust your body and birth team", "Breathe through every wave", "You've got this, super mama!"),
            checklist = listOf("Call labor ward when contractions are 5-1-1", "Grab your hospital bag", "Take deep relaxing breaths"),
            nutritionFocus = "Light, Easily Digestible Fuel",
            nutritionBenefit = "Provides gentle energy for active labor",
            foods = listOf("🍯 Honey & warm water", "🍌 Banana bites", "🥥 Coconut water", "🥣 Light broth")
        )
    )

    fun getInfoForWeek(week: Int): BabyWeekInfo {
        val clampedWeek = week.coerceIn(1, 40)
        return weekMap[clampedWeek] ?: generateInterpolatedWeek(clampedWeek)
    }

    private fun generateInterpolatedWeek(week: Int): BabyWeekInfo {
        val sizeCm = String.format("%.1f cm", (week * 1.3).coerceIn(0.2, 52.0))
        val weightKg = if (week < 10) "< 5 g" else if (week < 20) "${week * 15} g" else String.format("%.1f kg", (0.05 * week - 0.7).coerceAtLeast(0.3))
        val (animal, emoji, fruit, fruitEmoji) = when (week) {
            in 1..5 -> listOf("Tiny Sprout 🌱", "🌱", "Poppy Seed", "🌱")
            in 6..9 -> listOf("Little Ladybug 🐞", "🐞", "Blueberry", "🫐")
            in 10..13 -> listOf("Baby Hamster 🐹", "🐹", "Lime", "🍋")
            in 14..17 -> listOf("Baby Squirrel 🐿️", "🐿️", "Avocado", "🥑")
            in 18..21 -> listOf("Baby Bunny 🐰", "🐰", "Banana", "🍌")
            in 22..25 -> listOf("Baby Kitten 🐱", "🐱", "Papaya", "🥭")
            in 26..29 -> listOf("Baby Koala 🐨", "🐨", "Eggplant", "🍆")
            in 30..33 -> listOf("Baby Monkey 🐵", "🐵", "Cantaloupe", "🍈")
            in 34..37 -> listOf("Baby Lion Cub 🦁", "🦁", "Honeydew Melon", "🍈")
            else -> listOf("Sweet Newborn 👶", "👶", "Watermelon", "🍉")
        }

        return BabyWeekInfo(
            week = week,
            size = sizeCm,
            weight = weightKg,
            animal = animal,
            emoji = emoji,
            fruit = fruit,
            fruitEmoji = fruitEmoji,
            insight = "Week $week is marked by miraculous growth as vital organs mature and baby becomes more responsive.",
            feature = "Baby is developing daily sleep cycles and strengthening movements.",
            mamaTips = listOf("Keep up healthy hydration and gentle walking", "Listen to your body and rest when tired", "Track baby's active kicks"),
            checklist = listOf("Attend scheduled prenatal checkup", "Maintain daily nutrient goals", "Practice breathing exercises"),
            nutritionFocus = if (week <= 13) "Folate & Vital Minerals" else if (week <= 27) "DHA & Bone Building" else "Protein & Labor Stamina",
            nutritionBenefit = "Feeds rapid cellular expansion and nervous system wiring",
            foods = listOf("🥑 Avocado", "🥚 Eggs", "🍣 Salmon", "🌾 Whole grains", "🫘 Lentils", "🥜 Almonds")
        )
    }
}
