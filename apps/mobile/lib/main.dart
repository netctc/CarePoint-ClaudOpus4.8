import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/state/app_session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppSession.instance.init();
  runApp(const CarePointApp());
}
