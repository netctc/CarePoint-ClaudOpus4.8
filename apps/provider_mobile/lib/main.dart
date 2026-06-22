import 'package:flutter/widgets.dart';

import 'app/provider_mobile_app.dart';
import 'core/state/offline_action_queue.dart';
import 'core/state/provider_session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ProviderSession.instance.init();
  await OfflineActionQueue.instance.init(ProviderSession.instance.api);
  runApp(const CarePointProviderMobileApp());
}
