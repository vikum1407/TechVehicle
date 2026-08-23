const en = {
  'common.back': 'Back',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.error': 'Error',

  'settings.title': 'Settings',
  'settings.notificationPrefs': 'Notification Preferences',
  'settings.language': 'Language',
  'settings.language.english': 'English',
  'settings.language.sinhala': 'Sinhala',

  'login.tagline': "Your vehicle's digital service file",
  'login.signIn': 'Sign In',
  'login.enterMobile': 'Enter your mobile number',
  'login.sendOtp': 'Send OTP',
  'login.perk.serviceHistory': 'Service\nhistory',
  'login.perk.fuelMileage': 'Fuel &\nmileage',
  'login.perk.verifiedTransfer': 'Verified\ntransfer',
  'login.invalidNumber.title': 'Invalid number',
  'login.invalidNumber.message': 'Please enter a valid mobile number.',
  'login.selectCountry': 'Select Country',
  'login.searchCountry': 'Search country or code...',
  'login.noResultsFor': 'No results for "{query}"',

  'otp.tagline': 'Your vehicle companion',
  'otp.title': 'Enter OTP',
  'otp.codeSentTo': 'A 6-digit code was sent to',
  'otp.verify': 'Verify',
  'otp.changeNumber': 'Change number',
  'otp.invalid.title': 'Invalid OTP',
  'otp.invalid.message': 'Please enter the 6-digit code.',

  'role.useDifferentNumber': '← Use a different number',
  'role.title': 'How will you use the app?',
  'role.subtitle': 'Choose your primary role. You can always use both features after setup.',
  'role.owner.title': 'Vehicle Owner',
  'role.owner.desc': 'Track your vehicles, log service history, manage expenses and book garage appointments.',
  'role.garage.title': 'Garage / Service Center',
  'role.garage.desc': 'Manage your garage, receive bookings, submit service records to customers — and track your own personal vehicles too.',
  'role.selected': '✓ Selected',
  'role.continue': 'Continue →',
  'role.note': 'You can access all features after setup. This setting can be changed in your profile.',
}

export default en
export type TranslationKey = keyof typeof en
