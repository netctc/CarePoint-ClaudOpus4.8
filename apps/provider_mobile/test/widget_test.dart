import 'package:flutter_test/flutter_test.dart';

import 'package:carepoint_provider_mobile/app/provider_mobile_app.dart';

void main() {
  testWidgets('app boots', (WidgetTester tester) async {
    await tester.pumpWidget(const CarePointProviderMobileApp());
    expect(find.text('CarePoint Provider Mobile'), findsOneWidget);
  });
}
