plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "it.nutrifabio.stabbio"
    compileSdk = 35
    defaultConfig {
        applicationId = "it.nutrifabio.stabbio"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0-prototype"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies { implementation("androidx.core:core-ktx:1.15.0") }
