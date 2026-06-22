import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/state/provider_session.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class CarePointProviderMobileApp extends StatelessWidget {
  const CarePointProviderMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ProviderSession.instance,
      builder: (context, _) {
        final ProviderSession session = ProviderSession.instance;
        return MaterialApp.router(
          title: 'CarePoint Provider',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          routerConfig: appRouter,
          supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
          locale: Locale(session.languageCode),
          localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) => Directionality(
            textDirection: session.isRtl ? TextDirection.rtl : TextDirection.ltr,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
