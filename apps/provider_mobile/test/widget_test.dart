import 'package:flutter_test/flutter_test.dart';

import 'package:carepoint_provider_mobile/app/provider_mobile_app.dart';
import 'package:carepoint_provider_mobile/app/router/app_router.dart';

void main() {
  testWidgets('app boots', (WidgetTester tester) async {
    await tester.pumpWidget(const CarePointProviderMobileApp());
    expect(find.text('CarePoint Provider Mobile'), findsOneWidget);
  });

  test('unauthenticated provider is redirected to welcome', () {
    expect(
      providerRedirectForState(
        isAuthenticated: false,
        location: '/dashboard',
      ),
      '/welcome',
    );
  });

  test('authenticated provider leaves sign-in surfaces for dashboard', () {
    for (final String location in <String>['/welcome', '/sign-in', '/otp']) {
      expect(
        providerRedirectForState(
          isAuthenticated: true,
          location: location,
        ),
        '/dashboard',
      );
    }
  });

  test('authenticated provider can traverse dashboard, calendar, queue and appointment', () {
    expect(
      providerCriticalAppointmentRouteSequence,
      <String>['/dashboard', '/calendar', '/queue', '/appointments/test-appointment'],
    );

    for (final String location in providerCriticalAppointmentRouteSequence) {
      expect(
        providerRedirectForState(
          isAuthenticated: true,
          location: location,
        ),
        isNull,
        reason: 'authenticated provider should be allowed to reach $location',
      );
    }
  });
}
