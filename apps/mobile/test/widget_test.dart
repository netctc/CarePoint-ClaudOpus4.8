import 'package:flutter_test/flutter_test.dart';

import 'package:carepoint_mobile/app/app.dart';

void main() {
  testWidgets('app boots', (WidgetTester tester) async {
    await tester.pumpWidget(const CarePointApp());
    expect(find.text('CarePoint'), findsWidgets);
  });
}
