import 'package:go_router/go_router.dart';

import '../../core/state/app_session.dart';
import '../../features/auth/presentation/screens/otp_verification_page.dart';
import '../../features/appointments/presentation/screens/appointment_detail_page.dart';
import '../../features/appointments/presentation/screens/upcoming_appointments_page.dart';
import '../../features/booking/presentation/screens/appointment_intake_form_page.dart';
import '../../features/booking/presentation/screens/booking_confirmation_page.dart';
import '../../features/booking/presentation/screens/insurance_id_upload_page.dart';
import '../../features/booking/presentation/screens/review_payment_page.dart';
import '../../features/booking/presentation/screens/select_slot_page.dart';
import '../../features/encounter/presentation/screens/post_visit_summary_page.dart';
import '../../features/home/presentation/screens/home_dashboard_page.dart';
import '../../features/onboarding/presentation/screens/unified_entry_page.dart';
import '../../features/profile/presentation/screens/profile_setup_page.dart';
import '../../features/profile/presentation/screens/health_questionnaire_hub_page.dart';
import '../../features/profile/presentation/screens/health_questionnaire_version_detail_page.dart';
import '../../features/messages/presentation/screens/conversation_thread_page.dart';
import '../../features/messages/presentation/screens/messages_inbox_page.dart';
import '../../features/labs/presentation/screens/lab_result_detail_page.dart';
import '../../features/labs/presentation/screens/lab_results_list_page.dart';
import '../../features/prescriptions/presentation/screens/prescription_detail_page.dart';
import '../../features/prescriptions/presentation/screens/prescriptions_list_page.dart';
import '../../features/records/presentation/screens/document_detail_page.dart';
import '../../features/records/presentation/screens/medical_records_hub_page.dart';
import '../../features/telehealth/presentation/screens/in_call_telehealth_page.dart';
import '../../features/telehealth/presentation/screens/telehealth_waiting_room_page.dart';
import '../../features/billing/presentation/screens/invoices_refunds_page.dart';
import '../../features/care_plan/presentation/screens/care_plan_overview_page.dart';
import '../../features/care_plan/presentation/screens/task_detail_progress_page.dart';
import '../../features/family/presentation/screens/family_profiles_dependents_page.dart';
import '../../features/notifications/presentation/screens/notifications_center_page.dart';
import '../../features/reminders/presentation/screens/medication_reminders_page.dart';
import '../../features/rpm/presentation/screens/device_monitoring_setup_page.dart';
import '../../features/rpm/presentation/screens/vitals_rpm_trends_page.dart';
import '../../features/support/presentation/screens/support_complaints_page.dart';
import '../../features/wallet/presentation/screens/wallet_payment_methods_page.dart';
import '../../features/providers/presentation/screens/filter_sort_page.dart';
import '../../features/providers/presentation/screens/provider_profile_page.dart';
import '../../features/providers/presentation/screens/provider_reviews_page.dart';
import '../../features/providers/presentation/screens/search_providers_page.dart';
import '../../features/providers/presentation/screens/select_facility_location_page.dart';
import '../../features/providers/presentation/screens/select_service_page.dart';

const Set<String> _publicPaths = <String>{
  '/',
  '/entry',
  '/language',
  '/sign-in',
  '/otp',
};

const List<String> patientCriticalBookingRouteSequence = <String>[
  '/home',
  '/providers/search',
  '/providers/profile',
  '/booking/slot',
];

String? patientRedirectForState({
  required bool isAuthenticated,
  required bool profileSetupComplete,
  required String location,
}) {
  if (location == '/') {
    if (!isAuthenticated) {
      return '/entry';
    }
    if (!profileSetupComplete) {
      return '/profile-setup';
    }
    return '/home';
  }

  if (!isAuthenticated && !_publicPaths.contains(location)) {
    return '/entry';
  }

  if (isAuthenticated && (location == '/entry' || location == '/language' || location == '/sign-in' || location == '/otp' || location == '/consent')) {
    if (!profileSetupComplete) {
      return '/profile-setup';
    }
    return '/home';
  }

  if (isAuthenticated && !profileSetupComplete && location != '/profile-setup') {
    return '/profile-setup';
  }

  return null;
}

String? _stringExtraOrNull(Object? extra) => extra is String && extra.isNotEmpty ? extra : null;

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  refreshListenable: AppSession.instance,
  redirect: (context, state) {
    final AppSession session = AppSession.instance;
    return patientRedirectForState(
      isAuthenticated: session.isAuthenticated,
      profileSetupComplete: session.profileSetupComplete,
      location: state.matchedLocation,
    );
  },
  routes: <GoRoute>[
    GoRoute(path: '/', builder: (context, state) => const UnifiedEntryPage()),
    GoRoute(path: '/entry', name: 'entry', builder: (context, state) => const UnifiedEntryPage()),
    GoRoute(path: '/language', name: 'language', builder: (context, state) => const UnifiedEntryPage()),
    GoRoute(path: '/sign-in', name: 'signIn', builder: (context, state) => const UnifiedEntryPage()),
    GoRoute(path: '/otp', name: 'otp', builder: (context, state) => OtpVerificationPage(identifier: state.uri.queryParameters['identifier'])),
    GoRoute(path: '/profile-setup', name: 'profileSetup', builder: (context, state) => const ProfileSetupPage()),
    GoRoute(path: '/health-questionnaire', name: 'healthQuestionnaire', builder: (context, state) => const HealthQuestionnaireHubPage()),
    GoRoute(path: '/health-questionnaire/version', name: 'healthQuestionnaireVersion', builder: (context, state) => HealthQuestionnaireVersionDetailPage(versionId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra) ?? 'legacy-current')),
    GoRoute(path: '/consent', name: 'consent', builder: (context, state) => const UnifiedEntryPage()),
    GoRoute(path: '/home', name: 'home', builder: (context, state) => const HomeDashboardPage()),
    GoRoute(path: '/providers/search', name: 'searchProviders', builder: (context, state) => const SearchProvidersPage()),
    GoRoute(path: '/providers/filter', name: 'filterProviders', builder: (context, state) => const FilterSortPage()),
    GoRoute(path: '/providers/profile', name: 'providerProfile', builder: (context, state) => const ProviderProfilePage()),
    GoRoute(path: '/providers/reviews', name: 'providerReviews', builder: (context, state) => const ProviderReviewsPage()),
    GoRoute(path: '/providers/service', name: 'selectService', builder: (context, state) => const SelectServicePage()),
    GoRoute(path: '/providers/location', name: 'selectFacilityLocation', builder: (context, state) => const SelectFacilityLocationPage()),
    GoRoute(path: '/booking/slot', name: 'selectSlot', builder: (context, state) => const SelectSlotPage()),
    GoRoute(path: '/booking/intake', name: 'appointmentIntake', builder: (context, state) => const AppointmentIntakeFormPage()),
    GoRoute(path: '/booking/docs', name: 'insuranceUpload', builder: (context, state) => const InsuranceIdUploadPage()),
    GoRoute(path: '/booking/review', name: 'reviewPayment', builder: (context, state) => const ReviewPaymentPage()),
    GoRoute(path: '/booking/confirmation', name: 'bookingConfirmation', builder: (context, state) => const BookingConfirmationPage()),
    GoRoute(path: '/appointments/upcoming', name: 'upcomingAppointments', builder: (context, state) => const UpcomingAppointmentsPage()),
    GoRoute(path: '/appointments/detail', name: 'appointmentDetail', builder: (context, state) => AppointmentDetailPage(appointmentId: state.uri.queryParameters['id'])),
    GoRoute(
      path: '/telehealth/waiting',
      name: 'telehealthWaitingRoom',
      builder: (context, state) => TelehealthWaitingRoomPage(
        appointmentId: state.uri.queryParameters['appointmentId'],
        sessionId: state.uri.queryParameters['sessionId'],
      ),
    ),
    GoRoute(
      path: '/telehealth/call',
      name: 'inCallTelehealth',
      builder: (context, state) => InCallTelehealthPage(
        appointmentId: state.uri.queryParameters['appointmentId'],
        sessionId: state.uri.queryParameters['sessionId'],
      ),
    ),
    GoRoute(path: '/encounter/summary', name: 'postVisitSummary', builder: (context, state) => PostVisitSummaryPage(appointmentId: state.uri.queryParameters['appointmentId'])),
    GoRoute(path: '/messages/inbox', name: 'messagesInbox', builder: (context, state) => const MessagesInboxPage()),
    GoRoute(
      path: '/messages/thread',
      name: 'conversationThread',
      builder: (context, state) => ConversationThreadPage(
        threadId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra),
      ),
    ),
    GoRoute(path: '/records/hub', name: 'medicalRecordsHub', builder: (context, state) => const MedicalRecordsHubPage()),
    GoRoute(
      path: '/records/document',
      name: 'documentDetail',
      builder: (context, state) => DocumentDetailPage(documentId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra)),
    ),
    GoRoute(path: '/labs/list', name: 'labResultsList', builder: (context, state) => const LabResultsListPage()),
    GoRoute(
      path: '/labs/detail',
      name: 'labResultDetail',
      builder: (context, state) => LabResultDetailPage(resultId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra)),
    ),
    GoRoute(path: '/prescriptions/list', name: 'prescriptionsList', builder: (context, state) => const PrescriptionsListPage()),
    GoRoute(
      path: '/prescriptions/detail',
      name: 'prescriptionDetail',
      builder: (context, state) => PrescriptionDetailPage(prescriptionId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra)),
    ),
    GoRoute(path: '/care-plan', name: 'carePlanOverview', builder: (context, state) => const CarePlanOverviewPage()),
    GoRoute(
      path: '/care-plan/task',
      name: 'taskDetailProgress',
      builder: (context, state) => TaskDetailProgressPage(taskId: state.uri.queryParameters['id'] ?? _stringExtraOrNull(state.extra)),
    ),
    GoRoute(path: '/billing/invoices', name: 'billingInvoicesRefunds', builder: (context, state) => const InvoicesRefundsPage()),
    GoRoute(path: '/family/profiles', name: 'familyProfilesDependents', builder: (context, state) => const FamilyProfilesDependentsPage()),
    GoRoute(path: '/notifications/center', name: 'notificationsCenter', builder: (context, state) => const NotificationsCenterPage()),
    GoRoute(path: '/reminders/medication', name: 'medicationReminders', builder: (context, state) => const MedicationRemindersPage()),
    GoRoute(path: '/rpm/setup', name: 'deviceMonitoringSetup', builder: (context, state) => const DeviceMonitoringSetupPage()),
    GoRoute(path: '/rpm/trends', name: 'vitalsRpmTrends', builder: (context, state) => const VitalsRpmTrendsPage()),
    GoRoute(path: '/wallet/methods', name: 'walletPaymentMethods', builder: (context, state) => const WalletPaymentMethodsPage()),
    GoRoute(path: '/support', name: 'supportComplaints', builder: (context, state) => const SupportComplaintsPage()),
  ],
);