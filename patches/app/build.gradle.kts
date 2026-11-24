plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "it.nutrifabio.stabbio"
    compileSdk = 35

    signingConfigs {
        create("prototype") {
            storeFile = rootProject.file("nutrifabio-prototype.keystore")
            storePassword = "nutrifabio123"
            keyAlias = "nutrifabio"
            keyPassword = "nutrifabio123"
        }
    }

    defaultConfig {
        applicationId = "it.nutrifabio.stabbio.v12"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "1.3.2-prototype"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("prototype")
        }
    }
}

dependencies { implementation("androidx.core:core-ktx:1.15.0") }
