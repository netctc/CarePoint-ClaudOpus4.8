import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/provider_ui.dart';

class WelcomePage extends StatelessWidget {
  const WelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
          children: <Widget>[
            const SizedBox(height: 24),
            const Icon(Icons.health_and_safety_rounded, size: 72),
            const SizedBox(height: 20),
            Text('CarePoint Provider Mobile', style: Theme.of(context).textTheme.headlineLarge, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(
              'A dedicated mobile workspace for providers with queue management, secure messaging, telehealth, clinical operations, and mobile analytics.',
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            const ProviderHeroCard(
              title: 'Separate from the patient app',
              subtitle: 'This implementation starts a dedicated provider-side mobile application based on the existing provider web and service API layers.',
              badge: 'Provider workspace',
            ),
            const SizedBox(height: 20),
            const ProviderCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Included in this phase', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  SizedBox(height: 12),
                  _Bullet(text: 'Privileged provider sign-in with challenge verification'),
                  _Bullet(text: 'Dashboard, appointments, calendar, and alerts'),
                  _Bullet(text: 'Messages, telehealth, records, orders, prescriptions, labs, RPM'),
                  _Bullet(text: 'Team, settings, analytics, and cached read fallback'),
                ],
              ),
            ),
            const SizedBox(height: 24),
            AppPrimaryButton(
              label: 'Continue to sign in',
              icon: Icons.arrow_forward_rounded,
              onPressed: () => context.go('/sign-in'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Icon(Icons.check_circle_rounded, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium)),
        ],
      ),
    );
  }
}
