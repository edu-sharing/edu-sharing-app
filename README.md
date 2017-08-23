# edu-sharing mobile app

This project is the base for the mobile app offering edu-sharing features.

## Setup

Make sure basic frameworks are installed:

* NODEJS version should be >=6.9.5
* CORDOVA version should be >=7.0.1 
* IONIC version should be >=3.9.2

When you have NodeJS installed, you just need to run:

`npm install -g cordova ionic`

This will install ionic and also cordova for you.

## Run Local in Browser for Development

After a fresh check out just do:

`ionic serve`

you will be asked to download needed node modules - say YES .. and when ready the development browser view should open.


## Build App for Android & iOS

On first time building run a:

`cordova prepare`

Now all platform and plugin data will get loaded and added into your project.

Manually set the following config in /platforms/android/AndroidManifest.xml within element /manifest/application/activity (MainActivity):

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
</intent-filter>
```

Before final building check if you have all requirements for Android and iOS installed by using:

`cordova requirements`

Basic requirements should be:
* Java 1.8.x
* Android SDK Version : Android 7.1.1 (APi 25)
* Gradle  (https://gradle.org/install/)

_Note that if you build on Windows - you should probably remove the iOS platform from the configuration with `ionic cordova platform remove ios` to avoid error messages during build. Please remember to not commit a configuration without iOS later on._

Now you should be able to build the Android or iOS app:

`ionic cordova build android` or
`ionic cordova build ios`
