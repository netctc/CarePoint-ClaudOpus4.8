import 'package:flutter_test/flutter_test.dart';

import 'package:carepoint_mobile/app/app.dart';
import 'package:carepoint_mobile/app/router/app_router.dart';

void main() {
  testWidgets('app boots', (WidgetTester tester) async {
    await tester.pumpWidget(const CarePointApp());
    expect(find.text('CarePoint'), findsWidgets);
  });

  test('unauthenticated patient is redirected to entry', () {
    expect(
      patientRedirectForState(
        isAuthenticated: false,
        profileSetupComplete: false,
        location: '/home',
      ),
      '/entry',
    );
  });

  test('authenticated patient completes onboarding before home', () {
    expect(
      patientRedirectForState(
        isAuthenticated: true,
        profileSetupComplete: false,
        location: '/',
      ),
      '/profile-setup',
    );
    expect(
      patientRedirectForState(
        isAuthenticated: true,
        profileSetupComplete: true,
        location: '/',
      ),
      '/home',
    );
  });

  test('authenticated patient can traverse Find Care to booking slot', () {
    expect(
      patientCriticalBookingRouteSequence,
      <String>['/home', '/providers/search', '/providers/profile', '/booking/slot'],
    );

    for (final String location in patientCriticalBookingRouteSequence) {
      expect(
        patientRedirectForState(
          isAuthenticated: true,
          profileSetupComplete: true,
          location: location,
        ),
        isNull,
        reason: 'authenticated patient should be allowed to reach $location',
      );
    }
  });
}
