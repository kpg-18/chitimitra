import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import type { ViewShotRef } from 'react-native-view-shot';
import { useAppContext } from '../src/context/AppContext';
import { calculateChitSettlement, formatCurrency, getAdminFeePerMemberForRound, getFinalPayoutMember } from '../src/lib/finance';
import { formatReportDate, getAuctionHistory, getAuctionPaymentSummary, getPreviousAuctionWinners } from '../src/lib/auctionReport';
import { canManageGroup, getMemberGroups } from '../src/lib/groupAccess';
import type { AuctionRecord, AuctionRemainderMode, Group, Member, PaymentRecord } from '../src/types';

type ReportSelection = { type: 'history' } | { type: 'round'; round: number };

export default function AuctionScreen() {
  const { groupId: requestedGroupId } = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = Array.isArray(requestedGroupId) ? requestedGroupId[0] : requestedGroupId;
  const { state, recordAuction, recordFinalPayout, recordRoundContributions, setAuctionMemberPaid } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const user = state.user;
  const group = useMemo(() => {
    if (!user || !groupId) return undefined;
    return getMemberGroups(state.groups, user.id, user.name).find((item) => item.id === groupId);
  }, [groupId, state.groups, user]);
  const isAdmin = Boolean(group && user && canManageGroup(group, user.id, user.name));
  const members = group?.members ?? [];
  const auctions = group ? getAuctionHistory(group) : [];
  const currentRound = group?.currentRound ?? 1;
  const canRecordAuction = Boolean(group && currentRound <= group.instalmentCount);
  const roundKey = `${groupId ?? ''}:${currentRound}`;
  const [winnersByRound, setWinnersByRound] = useState<Record<string, string>>({});
  const [discountsByRound, setDiscountsByRound] = useState<Record<string, string>>({});
  const [auctionDate, setAuctionDate] = useState(getTodayDate());
  const [paidMembersByRound, setPaidMembersByRound] = useState<Record<string, Record<string, boolean>>>({});
  const [payersByRound, setPayersByRound] = useState<Record<string, Record<string, string>>>({});
  const [formError, setFormError] = useState('');
  const [collectionMessage, setCollectionMessage] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSelection, setReportSelection] = useState<ReportSelection>({ type: 'history' });
  const [exportRequest, setExportRequest] = useState<{ selection: ReportSelection; token: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<ViewShotRef>(null);

  useEffect(() => {
    if (!exportRequest) return;
    const timer = setTimeout(() => {
      void (async () => {
        setIsExporting(true);
        setReportError('');
        try {
          if (!reportRef.current) throw new Error('The report preview is not ready yet. Please try again.');
          const fileName = getReportFileName(group?.name ?? 'chiti-mitra', exportRequest.selection);
          if (Platform.OS === 'web') {
            const base64 = await reportRef.current.capture();
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${base64}`;
            link.download = `${fileName}.jpg`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          } else {
            const uri = await reportRef.current.capture();
            if (!await Sharing.isAvailableAsync()) {
              throw new Error('Sharing is not available on this device. Try downloading the JPG from the web app.');
            }
            await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Save or share chit auction JPG' });
          }
        } catch (error) {
          setReportError(error instanceof Error ? error.message : 'Could not create the JPG report.');
        } finally {
          setIsExporting(false);
          setExportRequest(null);
        }
      })();
    }, 120);
    return () => clearTimeout(timer);
  }, [exportRequest, group?.name]);

  if (!group || !user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.pageTitle, { color: palette.text }]}>Group not available</Text>
        <Text style={[styles.muted, { color: palette.muted }]}>Only group members can access auction records.</Text>
        <Button label="Back to groups" onPress={() => router.replace('/groups')} palette={palette} />
      </View>
    );
  }

  const selectedAuctions = reportSelection.type === 'history'
    ? auctions
    : auctions.filter((auction) => auction.round === reportSelection.round);
  const defaultDiscount = group.chitType === 'fixed-discount'
    ? group.fixedDiscountAmount
    : group.chitType === 'lucky-draw'
      ? Math.floor(group.totalAmount * group.foremanCommissionPercent / 100)
      : group.minimumBidDiscount;
  const winningDiscount = discountsByRound[roundKey] ?? String(defaultDiscount);
  const winnerMemberId = winnersByRound[roundKey] ?? '';
  const paidMembers = paidMembersByRound[roundKey] ?? {};
  const payers = payersByRound[roundKey] ?? {};
  const remainderMode: AuctionRemainderMode = 'reserve';
  const finalPayoutMember = getFinalPayoutMember(group);
  const previousWinners = new Set(auctions.map((auction) => auction.winnerMemberId));
  const eligibleMembers = members.filter((member) => !previousWinners.has(member.id));
  const savedRoundAmounts = new Map(
    group.payments
      .filter((payment) => payment.round === currentRound && payment.type === 'collection')
      .map((payment) => [payment.memberId, payment.amount]),
  );
  const savedAdminFees = new Map(
    group.payments
      .filter((payment) => payment.round === currentRound && payment.type === 'admin-fee')
      .map((payment) => [payment.memberId, payment.amount]),
  );
  const setWinnerMemberId = (memberId: string) => {
    setWinnersByRound((current) => ({ ...current, [roundKey]: memberId }));
  };
  const setWinningDiscount = (discount: string) => {
    setDiscountsByRound((current) => ({ ...current, [roundKey]: discount }));
  };
  const setMemberPaid = (memberId: string, isPaid: boolean) => {
    setFormError('');
    setCollectionMessage('');
    setPaidMembersByRound((current) => ({
      ...current,
      [roundKey]: { ...current[roundKey], [memberId]: isPaid },
    }));
    if (isPaid && !payers[memberId]) {
      const member = members.find((item) => item.id === memberId);
      setPayersByRound((current) => ({
        ...current,
        [roundKey]: { ...current[roundKey], [memberId]: member?.name ?? '' },
      }));
    }
  };
  const setPayerName = (memberId: string, value: string) => {
    setPayersByRound((current) => ({
      ...current,
      [roundKey]: { ...current[roundKey], [memberId]: value },
    }));
  };

  const saveContributions = () => {
    setFormError('');
    const contributions = members.map((member) => ({
      memberId: member.id,
      amount: (paidMembers[member.id] ?? ((savedRoundAmounts.get(member.id) ?? 0) >= settlement.effectiveContribution)) ? settlement.effectiveContribution : 0,
      adminFeeAmount: (paidMembers[member.id] ?? ((savedAdminFees.get(member.id) ?? 0) >= adminFeePerMember)) ? adminFeePerMember : 0,
      paidByName: payers[member.id] || member.name,
    }));
    if (!recordRoundContributions(group.id, currentRound, contributions)) {
      setFormError('Could not save collections. Check your admin access and the member amounts.');
      return;
    }
    setCollectionMessage('Round collections saved. Continue the auction when ready.');
  };

  const saveAuction = () => {
    setFormError('');
    const discount = Number(winningDiscount);
    const selectedWinnerMemberId = winnerMemberId || eligibleMembers[0]?.id;
    if (!selectedWinnerMemberId) {
      setFormError('Choose the member who won this auction.');
      return;
    }
    if (!eligibleMembers.some((member) => member.id === selectedWinnerMemberId)) {
      setFormError('This member has already received a chit payout. Choose a member who has not won.');
      return;
    }
    const grossPot = group.totalAmount + (group.carryForwardBalance ?? 0);
    const minimumDiscount = group.chitType === 'auction'
      ? Math.max(group.minimumBidDiscount, Math.floor(grossPot * group.foremanCommissionPercent / 100))
      : group.chitType === 'fixed-discount'
        ? group.fixedDiscountAmount
        : Math.floor(grossPot * group.foremanCommissionPercent / 100);
    const maximumDiscount = Math.floor(grossPot * 0.3);
    if (!Number.isSafeInteger(discount) || discount < minimumDiscount || discount > maximumDiscount) {
      setFormError(`Discount must be between ₹${minimumDiscount.toLocaleString('en-IN')} and ₹${maximumDiscount.toLocaleString('en-IN')}.`);
      return;
    }
    if (!isValidDate(auctionDate)) {
      setFormError('Enter a valid auction date in YYYY-MM-DD format.');
      return;
    }
    const auction = recordAuction(group.id, {
      date: auctionDate,
      winnerMemberId: selectedWinnerMemberId,
      winningDiscount: discount,
      remainderMode,
      memberContributions: members.map((member) => ({
        memberId: member.id,
        amount: (paidMembers[member.id] ?? ((savedRoundAmounts.get(member.id) ?? 0) >= settlement.effectiveContribution)) ? settlement.effectiveContribution : 0,
        adminFeeAmount: (paidMembers[member.id] ?? ((savedAdminFees.get(member.id) ?? 0) >= adminFeePerMember)) ? adminFeePerMember : 0,
        paidByName: payers[member.id] || member.name,
      })),
    });
    if (!auction) {
      setFormError('This auction could not be saved. Check your admin access and the group round.');
      return;
    }
    setReportSelection({ type: 'round', round: auction.round });
    setAuctionDate(getTodayDate());
  };

  const saveFinalPayout = () => {
    setFormError('');
    if (!finalPayoutMember) return;
    const feeAmounts = members.map((member) => ({
      memberId: member.id,
      amount: (paidMembers[member.id] ?? ((savedAdminFees.get(member.id) ?? 0) >= adminFeePerMember)) ? adminFeePerMember : 0,
      paidByName: payers[member.id] || member.name,
    }));
    const result = recordFinalPayout(group.id, auctionDate, feeAmounts);
    if (!result) {
      setFormError('The final chit payout could not be recorded. Verify the reserve balance and group admin access.');
      return;
    }
    setReportSelection({ type: 'round', round: result.round });
    setAuctionDate(getTodayDate());
  };

  const currentDiscountValue = Number(winningDiscount) || 0;
  const grossPot = group.totalAmount + (group.carryForwardBalance ?? 0);
  const estimatedCommission = group.managementMode === 'agent-managed'
    ? Math.floor(grossPot * group.foremanCommissionPercent / 100)
    : 0;
  const settlement = calculateChitSettlement({
    grossPot,
    winningDiscount: currentDiscountValue,
    foremanCommission: Math.min(estimatedCommission, currentDiscountValue),
    memberCount: group.memberCount,
    monthlyContribution: group.monthlyContribution,
    remainderMode,
  });
  const adminFeePerMember = getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, currentRound);
  const raiseDiscount = () => {
    const startingDiscount = currentDiscountValue || group.minimumBidDiscount;
    const nextDiscount = startingDiscount + group.bidIncrement;
    if (nextDiscount <= Math.floor(grossPot * 0.3)) setWinningDiscount(String(nextDiscount));
  };
  const drawEligibleWinner = () => {
    if (eligibleMembers.length === 0) return;
    const pick = eligibleMembers[pickRandomIndex(eligibleMembers.length)];
    setWinnerMemberId(pick.id);
  };

  const requestExport = (selection: ReportSelection) => {
    setReportSelection(selection);
    setReportError('');
    setExportRequest({ selection, token: Date.now() });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/groups')} style={styles.backLink}>
          <Text style={[styles.backText, { color: palette.primary }]}>← Groups</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: palette.text }]}>Chit auctions</Text>
        <Text style={[styles.groupTitle, { color: palette.primary }]}>{group.name}</Text>
        <Text style={[styles.muted, { color: palette.muted }]}>
          {getChitTypeLabel(group.chitType)} · {group.memberCount} members · {group.instalmentCount} rounds
        </Text>
        <Text style={[styles.muted, { color: palette.muted }]}>
          ₹{group.monthlyContribution.toLocaleString('en-IN')} base per member/month · ₹{grossPot.toLocaleString('en-IN')} available pot this round
        </Text>
        <Text style={[styles.muted, { color: palette.muted }]}>
          Carried into this round ₹{group.carryForwardBalance.toLocaleString('en-IN')} · Accumulated discount balance ₹{group.reserveBalance.toLocaleString('en-IN')}
        </Text>

        {isAdmin && canRecordAuction && finalPayoutMember && (
          <View style={[styles.card, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
            <Text style={[styles.sectionTitle, { color: palette.primary }]}>Final member payout · Round {currentRound}</Text>
            <Text style={[styles.helpText, { color: palette.text }]}>
              {finalPayoutMember.name} is the only member who has not received a payout. The accumulated balance covers the ₹{group.totalAmount.toLocaleString('en-IN')} chit amount, so no member contributes to the chit this round.
            </Text>
            <Text style={[styles.historyWinner, { color: palette.primary }]}>
              {finalPayoutMember.name} receives {formatCurrency(group.totalAmount)}
            </Text>
            <Text style={[styles.helpText, { color: palette.muted }]}>
              Balance remaining after payout: {formatCurrency(group.reserveBalance - group.totalAmount)}. Optional admin fees remain separate from the chit payout.
            </Text>
            <Text style={[styles.label, { color: palette.muted }]}>Payout date</Text>
            <TextInput
              accessibilityLabel="Final payout date"
              value={auctionDate}
              onChangeText={setAuctionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
            />
            {adminFeePerMember > 0 && (
              <>
                <Text style={[styles.label, { color: palette.muted }]}>Optional admin fees</Text>
                <Text style={[styles.helpText, { color: palette.muted }]}>
                  These are separate from contributions waived for this final payout round.
                </Text>
                {members.map((member) => {
                  const feePaid = paidMembers[member.id] ?? ((savedAdminFees.get(member.id) ?? 0) >= adminFeePerMember);
                  return (
                    <View key={member.id} style={[styles.paymentChoice, { backgroundColor: palette.card, borderColor: palette.border }]}>
                      <TouchableOpacity
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: feePaid }}
                        onPress={() => setMemberPaid(member.id, !feePaid)}
                        style={styles.paymentMemberDetails}
                      >
                        <Text style={[styles.paymentMember, { color: palette.text }]}>{feePaid ? '☑' : '☐'} {member.name}</Text>
                        <Text style={[styles.paymentStatus, { color: feePaid ? palette.primary : palette.muted }]}>
                          Admin fee · {formatCurrency(adminFeePerMember)}
                        </Text>
                      </TouchableOpacity>
                      {feePaid && (
                        <TextInput
                          accessibilityLabel={`${member.name} admin fee paid by`}
                          value={payers[member.id] ?? member.name}
                          onChangeText={(value) => setPayerName(member.id, value)}
                          placeholder="Who paid?"
                          placeholderTextColor={palette.muted}
                          style={[styles.amountInput, { backgroundColor: palette.softBg, borderColor: palette.border, color: palette.text }]}
                        />
                      )}
                    </View>
                  );
                })}
              </>
            )}
            {formError ? <Text accessibilityRole="alert" style={styles.errorText}>{formError}</Text> : null}
            <Button label="Record final member payout" onPress={saveFinalPayout} palette={palette} />
          </View>
        )}

        {isAdmin && canRecordAuction && !finalPayoutMember && (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {group.chitType === 'auction' ? 'Run auction' : group.chitType === 'fixed-discount' ? 'Record fixed-discount round' : 'Run lucky draw'} · Round {currentRound}
            </Text>
            <Text style={[styles.helpText, { color: palette.muted }]}>
              This group is active now. Record contributions for the round and settle the winner when ready.
            </Text>
            <Text style={[styles.label, { color: palette.muted }]}>Auction date</Text>
            <TextInput
              accessibilityLabel="Auction date"
              value={auctionDate}
              onChangeText={setAuctionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={[styles.input, { backgroundColor: palette.softBg, borderColor: palette.border, color: palette.text }]}
            />
            <Text style={[styles.label, { color: palette.muted }]}>
              {group.chitType === 'lucky-draw' ? 'Draw a member who has not received a payout yet' : 'Select a member who has not received a payout'}
            </Text>
            {group.chitType === 'lucky-draw' && (
              <Button
                label={eligibleMembers.length > 0 ? 'Draw winner at random' : 'All members have received a payout'}
                onPress={drawEligibleWinner}
                palette={palette}
                disabled={eligibleMembers.length === 0}
              />
            )}
            <View style={styles.memberPicker}>
              {eligibleMembers.map((member) => (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: winnerMemberId === member.id }}
                  key={member.id}
                  onPress={() => setWinnerMemberId(member.id)}
                  style={[
                    styles.memberChoice,
                    { backgroundColor: winnerMemberId === member.id ? palette.primarySoft : palette.softBg, borderColor: palette.border },
                  ]}
                >
                  <Text style={{ color: winnerMemberId === member.id ? palette.primary : palette.text, fontWeight: '700' }}>
                    {member.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {group.chitType === 'auction' ? (
              <>
                <Text style={[styles.label, { color: palette.muted }]}>Current winning discount (₹)</Text>
                <Text style={[styles.helpText, { color: palette.muted }]}>
                  Highest discount wins. Enter a first bid, then raise it by your selected increment.
                </Text>
                <TextInput
                  accessibilityLabel="Current winning discount"
                  value={winningDiscount}
                  onChangeText={setWinningDiscount}
                  keyboardType="number-pad"
                  placeholder={String(group.minimumBidDiscount)}
                  placeholderTextColor={palette.muted}
                  style={[styles.input, { backgroundColor: palette.softBg, borderColor: palette.border, color: palette.text }]}
                />
                <View style={styles.bidControls}>
                  <Text style={[styles.helpText, { color: palette.muted }]}>Raise bid by ₹{group.bidIncrement}:</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Raise discount by ${group.bidIncrement} rupees`}
                    onPress={raiseDiscount}
                    disabled={currentDiscountValue + group.bidIncrement > Math.floor(grossPot * 0.3)}
                    style={[
                      styles.raiseButton,
                      { backgroundColor: palette.primary, opacity: currentDiscountValue + group.bidIncrement > Math.floor(grossPot * 0.3) ? 0.5 : 1 },
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>+ ₹{group.bidIncrement}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={[styles.helpText, { color: palette.muted }]}>
                {group.chitType === 'fixed-discount'
                  ? `Agreed discount: ₹${group.fixedDiscountAmount.toLocaleString('en-IN')}`
                  : `Draw settlement discount: ₹${estimatedCommission.toLocaleString('en-IN')}`}
              </Text>
            )}

            <View style={[styles.settlementCard, { backgroundColor: palette.primarySoft }]}>
              <Text style={[styles.settlementTitle, { color: palette.primary }]}>Round settlement preview</Text>
              <SettlementLine label="Gross pot" value={settlement.grossPot} palette={palette} />
              <SettlementLine label="Winning discount" value={settlement.winningDiscount} palette={palette} />
              <SettlementLine label="Agent / foreman fee" value={settlement.foremanCommission} palette={palette} />
              <SettlementLine label="Discount remainder after agent fee" value={settlement.remainingAmount} palette={palette} />
              <SettlementLine label="Previously accumulated discount balance" value={group.reserveBalance} palette={palette} />
              <SettlementLine label="Accumulated balance after this round" value={group.reserveBalance + settlement.reserveAmount} palette={palette} />
              {adminFeePerMember > 0 && (
                <SettlementLine
                  label={`Admin fee · ₹${adminFeePerMember.toLocaleString('en-IN')} per member (separate)`}
                  value={adminFeePerMember * members.length}
                  palette={palette}
                />
              )}
              <SettlementLine label="Dividend per member" value={settlement.dividendPerMember} palette={palette} />
              {settlement.carryForwardAmount > 0 && (
                <SettlementLine label="Added to next round's pot" value={settlement.carryForwardAmount} palette={palette} />
              )}
              {settlement.reserveAmount > 0 && (
                <SettlementLine label="Added to group reserve" value={settlement.reserveAmount} palette={palette} />
              )}
              <SettlementLine label="Net contribution per member" value={settlement.effectiveContribution} palette={palette} />
              <SettlementLine label="Winner receives" value={settlement.winnerPayout} palette={palette} strong />
            </View>

            <Text style={[styles.label, { color: palette.muted }]}>Accumulated discount rule</Text>
            <Text style={[styles.helpText, { color: palette.muted }]}>
              The ₹{settlement.remainingAmount.toLocaleString('en-IN')} remainder is added to the group balance. When it covers the chit amount and one member is still waiting for a payout, that member receives the final payout and member contributions are waived for that round.
            </Text>
            <Text style={[styles.label, { color: palette.muted }]}>Mark member payments</Text>
            <Text style={[styles.helpText, { color: palette.muted }]}>
              Check a member only after the full calculated amount is received. Base contribution: {formatCurrency(settlement.effectiveContribution)}; separate admin fee: {formatCurrency(adminFeePerMember)}. Enter another payer’s name when someone pays on a member’s behalf.
            </Text>
            {members.map((member) => {
              const isPaid = paidMembers[member.id] ?? (
                (savedRoundAmounts.get(member.id) ?? 0) >= settlement.effectiveContribution
                && (savedAdminFees.get(member.id) ?? 0) >= adminFeePerMember
                && (settlement.effectiveContribution > 0 || adminFeePerMember > 0)
              );
              const savedPayer = group.payments.find((payment) =>
                payment.round === currentRound
                && payment.memberId === member.id
                && (payment.type === 'collection' || payment.type === 'admin-fee'),
              )?.paidByName;
              return (
                <View
                  key={member.id}
                  style={[styles.paymentChoice, { backgroundColor: palette.softBg, borderColor: palette.border }]}
                >
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isPaid }}
                    onPress={() => setMemberPaid(member.id, !isPaid)}
                    style={styles.paymentMemberDetails}
                  >
                    <Text style={[styles.paymentMember, { color: palette.text }]}>{isPaid ? '☑' : '☐'} {member.name}</Text>
                    <Text style={[styles.paymentStatus, { color: isPaid ? palette.primary : palette.muted }]}>
                      {isPaid ? 'Paid' : 'Not paid'} · {formatCurrency(settlement.effectiveContribution + adminFeePerMember)}
                    </Text>
                  </TouchableOpacity>
                  {isPaid && (
                    <TextInput
                      accessibilityLabel={`${member.name} paid by`}
                      value={payers[member.id] ?? savedPayer ?? member.name}
                      onChangeText={(value) => setPayerName(member.id, value)}
                      placeholder="Who paid?"
                      placeholderTextColor={palette.muted}
                      style={[styles.amountInput, { backgroundColor: palette.card, borderColor: palette.border, color: palette.text }]}
                    />
                  )}
                </View>
              );
            })}

            {collectionMessage ? (
              <Text accessibilityRole="status" style={[styles.successText, { color: palette.primary }]}>{collectionMessage}</Text>
            ) : null}
            <Button label="Save payment checkboxes" onPress={saveContributions} palette={palette} />
            {formError ? <Text accessibilityRole="alert" style={styles.errorText}>{formError}</Text> : null}
            <Button label="Save auction result & start next round" onPress={saveAuction} palette={palette} />
          </View>
        )}

        {!isAdmin && (
          <View style={[styles.notice, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.text }}>Auction records are read-only for group members. Ask a group admin to update them.</Text>
          </View>
        )}
        {isAdmin && !canRecordAuction && (
          <View style={[styles.notice, { backgroundColor: palette.primarySoft }]}>
            <Text style={{ color: palette.text }}>All {group.instalmentCount} chit rounds have auction records.</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Auction history & JPG reports</Text>
          {auctions.length === 0 ? (
            <Text style={[styles.muted, { color: palette.muted }]}>Save a completed auction to build this group’s winner and payment history.</Text>
          ) : (
            <>
              <View style={styles.exportActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => requestExport({ type: 'history' })}
                  disabled={isExporting}
                  style={[styles.exportButton, { backgroundColor: palette.primary }]}
                >
                  <Text style={styles.exportButtonText}>Download full history JPG</Text>
                </TouchableOpacity>
              </View>
              {auctions.map((auction) => (
                <AuctionHistoryRow
                  key={auction.id}
                  auction={auction}
                  members={members}
                  payments={group.payments.filter((payment) => payment.round === auction.round)}
                  contribution={group.monthlyContribution}
                  adminFeePerMember={getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, auction.round)}
                  editable={isAdmin && auction.outcomeType !== 'final-payout'}
                  onTogglePaid={(memberId, isPaid) => {
                    if (!setAuctionMemberPaid(group.id, auction.id, memberId, isPaid)) {
                      setReportError('Could not update this payment. Check that you are a group admin.');
                    }
                  }}
                  onExport={() => requestExport({ type: 'round', round: auction.round })}
                  palette={palette}
                />
              ))}
            </>
          )}
          {reportError ? <Text accessibilityRole="alert" style={styles.errorText}>{reportError}</Text> : null}
        </View>

        {selectedAuctions.length > 0 && (
          <View style={styles.reportPreview}>
            <Text style={[styles.previewLabel, { color: palette.muted }]}>
              {reportSelection.type === 'history' ? 'Full history JPG preview' : `Round ${reportSelection.round} JPG preview`}
            </Text>
            <ViewShot
              ref={reportRef}
              options={{
                fileName: getReportFileName(group.name, reportSelection),
                format: 'jpg',
                quality: 0.94,
                result: Platform.OS === 'web' ? 'base64' : 'tmpfile',
              }}
              style={styles.captureFrame}
            >
              <ReportImage
                group={group}
                auctions={selectedAuctions}
                allAuctions={auctions}
                members={members}
                singleRound={reportSelection.type === 'round'}
              />
            </ViewShot>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" onPress={() => router.replace('/')} palette={palette} />
        <NavItem label="Groups" active onPress={() => router.replace('/groups')} palette={palette} />
        <NavItem label="Payments" onPress={() => router.replace('/payments')} palette={palette} />
        <NavItem label="Activity" onPress={() => router.replace('/activity')} palette={palette} />
        <NavItem label="Profile" onPress={() => router.replace('/profile')} palette={palette} />
      </View>
      {isExporting && (
        <View style={styles.exportingOverlay}>
          <ActivityIndicator color="#ffffff" />
          <Text style={styles.exportingText}>Preparing JPG report…</Text>
        </View>
      )}
    </View>
  );
}

function AuctionHistoryRow({
  auction,
  members,
  payments,
  contribution,
  adminFeePerMember,
  editable,
  onTogglePaid,
  onExport,
  palette,
}: {
  auction: AuctionRecord;
  members: Member[];
  payments: PaymentRecord[];
  contribution: number;
  adminFeePerMember: number;
  editable: boolean;
  onTogglePaid: (memberId: string, isPaid: boolean) => void;
  onExport: () => void;
  palette: typeof lightColors;
}) {
  const summary = getAuctionPaymentSummary(auction, members);
  return (
    <View style={[styles.historyCard, { backgroundColor: palette.softBg, borderColor: palette.border }]}>
      <View style={styles.historyTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.historyTitle, { color: palette.text }]}>
            {auction.outcomeType === 'final-payout' ? 'Final payout' : 'Round'} {auction.round} · {formatReportDate(auction.date)}
          </Text>
          <Text style={[styles.historyWinner, { color: palette.primary }]}>
            {auction.outcomeType === 'final-payout'
              ? `${auction.winnerName} received the final chit balance · ${formatCurrency(auction.payoutAmount)}`
              : `${auction.winnerName} won · ${formatCurrency(auction.payoutAmount)} payout`}
          </Text>
          {auction.outcomeType !== 'final-payout' && (
            <Text style={[styles.paymentSummary, { color: palette.muted }]}>
              {formatCurrency(auction.winningDiscount)} discount · {formatCurrency(auction.foremanCommission)} agent fee · {formatCurrency(auction.adminFeeCollected)} admin fee collected
            </Text>
          )}
          <Text style={[styles.paymentSummary, { color: palette.muted }]}>
            {auction.outcomeType === 'final-payout'
              ? `All chit contributions waived · Remaining balance ${formatCurrency(auction.reserveBalanceAfter ?? 0)}`
              : `${formatCurrency(auction.remainingAmount)} remainder · ${auction.remainderMode === 'dividend' ? 'dividend' : auction.remainderMode === 'carry-forward' ? `${formatCurrency(auction.carryForwardAmount)} carried forward` : `${formatCurrency(auction.reserveAmount)} added to accumulated balance`}`}
          </Text>
          {auction.outcomeType === 'final-payout' ? (
            <Text style={[styles.paymentSummary, { color: palette.primary }]}>No chit contributions collected this round.</Text>
          ) : (
            <Text style={[styles.paymentSummary, { color: summary.allPaid ? palette.primary : palette.danger }]}>
              {summary.allPaid
                ? 'All members paid'
                : `${summary.paidCount}/${members.length} paid · Not paid: ${summary.unpaidMembers.map((member) => member.name).join(', ')}`}
            </Text>
          )}
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={onExport} style={[styles.roundExportButton, { borderColor: palette.primary }]}>
          <Text style={{ color: palette.primary, fontWeight: '700' }}>Round JPG</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.historyMembers}>
        {members.map((member) => {
          const paid = auction.paidMemberIds.includes(member.id);
          const amount = auction.contributions?.find((item) => item.memberId === member.id)?.amount ?? (paid ? contribution - auction.dividendPerMember : 0);
          const payment = payments.find((item) => item.memberId === member.id && item.type === 'collection');
          const waived = auction.waivedContributionMemberIds?.includes(member.id) ?? false;
          return (
            <TouchableOpacity
              key={member.id}
              disabled={!editable}
              accessibilityRole={editable ? 'checkbox' : undefined}
              accessibilityState={editable ? { checked: paid } : undefined}
              onPress={() => onTogglePaid(member.id, !paid)}
              style={[styles.historyMemberRow, { borderTopColor: palette.border }]}
            >
              <Text style={[styles.historyMemberName, { color: palette.text }]}>{member.name}</Text>
              <Text style={{ color: waived || paid ? palette.primary : palette.danger, fontWeight: '700' }}>
                {waived
                  ? 'Contribution waived'
                  : `${paid ? 'Paid' : amount > 0 ? `Partial ${formatCurrency(amount)}` : 'Not paid'} · ${formatCurrency(contribution - auction.dividendPerMember + adminFeePerMember)} due`}
              </Text>
              {payment?.paidByName && payment.paidByName !== member.name && (
                <Text style={{ color: palette.muted, fontSize: 12 }}>Paid by {payment.paidByName} for {member.name}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ReportImage({
  group,
  auctions,
  allAuctions,
  members,
  singleRound,
}: {
  group: Group;
  auctions: AuctionRecord[];
  allAuctions: AuctionRecord[];
  members: Member[];
  singleRound: boolean;
}) {
  return (
    <View style={reportStyles.page}>
      <Text style={reportStyles.brand}>CHITI MITRA · CHIT AUCTION REPORT</Text>
      <Text style={reportStyles.groupName}>{group.name}</Text>
      <Text style={reportStyles.meta}>
        {group.memberCount} members · Contribution ₹{group.monthlyContribution.toLocaleString('en-IN')} · {group.instalmentCount} rounds
      </Text>
      <Text style={reportStyles.meta}>
        Group pot ₹{group.totalAmount.toLocaleString('en-IN')} · Monthly due day {group.dueDay}
      </Text>
      <Text style={reportStyles.meta}>
        {getChitTypeLabel(group.chitType)} · {group.managementMode === 'agent-managed' ? `Agent fee ${group.foremanCommissionPercent}%` : 'Self-managed'}
      </Text>
      <Text style={reportStyles.meta}>
        Current accumulated discount balance: {formatCurrency(group.reserveBalance)}
      </Text>
      <View style={reportStyles.rule} />
      {auctions.map((auction) => (
        <ReportAuction
          key={auction.id}
          auction={auction}
          members={members}
          contribution={group.monthlyContribution}
          adminFeePerMember={getAdminFeePerMemberForRound(group.adminFeeMode ?? 'none', group.adminFeeAmount ?? 0, auction.round)}
          roundPayments={group.payments.filter((payment) => payment.round === auction.round)}
        />
      ))}
      {singleRound && auctions[0] && (
        <PreviousWinners group={group} round={auctions[0].round} />
      )}
      {!singleRound && (
        <View style={reportStyles.previousSection}>
          <Text style={reportStyles.sectionHeading}>Recorded chit winners</Text>
          {allAuctions.map((auction) => (
            <Text key={auction.id} style={reportStyles.previousWinner}>
              Round {auction.round} · {formatReportDate(auction.date)} · {auction.outcomeType === 'final-payout' ? 'Final payout' : 'Auction'} · {auction.winnerName} · {formatCurrency(auction.payoutAmount)}
            </Text>
          ))}
        </View>
      )}
      <Text style={reportStyles.footer}>Generated by Chiti Mitra · Keep this report for your group records</Text>
    </View>
  );
}

function ReportAuction({
  auction,
  members,
  contribution,
  adminFeePerMember,
  roundPayments,
}: {
  auction: AuctionRecord;
  members: Member[];
  contribution: number;
  adminFeePerMember: number;
  roundPayments: PaymentRecord[];
}) {
  const summary = getAuctionPaymentSummary(auction, members);
  return (
    <View style={reportStyles.auctionBlock}>
      <Text style={reportStyles.sectionHeading}>{auction.outcomeType === 'final-payout' ? 'Final member payout' : 'Auction'} · Round {auction.round}</Text>
      <Text style={reportStyles.info}>Date: {formatReportDate(auction.date)}</Text>
      <Text style={reportStyles.info}>{auction.outcomeType === 'final-payout' ? 'Final recipient' : 'Winner'}: {auction.winnerName}</Text>
      {auction.outcomeType !== 'final-payout' && (
        <>
          <Text style={reportStyles.info}>Winning discount: {formatCurrency(auction.winningDiscount)}</Text>
          <Text style={reportStyles.info}>Agent / foreman commission: {formatCurrency(auction.foremanCommission)}</Text>
        </>
      )}
      <Text style={reportStyles.info}>Admin fee collected: ₹{auction.adminFeeCollected.toLocaleString('en-IN')}</Text>
      {auction.outcomeType !== 'final-payout' && (
        <>
          <Text style={reportStyles.info}>Dividend per member: {formatCurrency(auction.dividendPerMember)}</Text>
          <Text style={reportStyles.info}>
            Remainder: {formatCurrency(auction.remainingAmount)} · {auction.remainderMode === 'dividend' ? 'distributed as dividend' : auction.remainderMode === 'carry-forward' ? `${formatCurrency(auction.carryForwardAmount)} carried forward` : `${formatCurrency(auction.reserveAmount)} added to chit balance`}
          </Text>
        </>
      )}
      <Text style={reportStyles.info}>Payout received: {formatCurrency(auction.payoutAmount)}</Text>
      {auction.outcomeType === 'final-payout' && (
        <Text style={reportStyles.info}>Member contributions waived this round. Balance after payout: {formatCurrency(auction.reserveBalanceAfter ?? 0)}</Text>
      )}
      {auction.outcomeType === 'final-payout' ? (
        <Text style={reportStyles.paid}>Contributions waived for all members this round.</Text>
      ) : (
        <>
          <Text style={reportStyles.info}>
            Contributions: {summary.allPaid
              ? 'All members paid'
              : `${summary.paidCount} paid · ${summary.unpaidMembers.length} not paid`}
          </Text>
          {summary.unpaidMembers.length > 0 && (
            <Text style={reportStyles.unpaid}>Not paid: {summary.unpaidMembers.map((member) => member.name).join(', ')}</Text>
          )}
          {summary.allPaid && <Text style={reportStyles.paid}>Payment status: Paid in full</Text>}
        </>
      )}
      <View style={reportStyles.tableHeader}>
        <Text style={[reportStyles.tableCell, reportStyles.memberColumn, reportStyles.tableHeaderText]}>Member</Text>
        <Text style={[reportStyles.tableCell, reportStyles.amountColumn, reportStyles.tableHeaderText]}>Paid / due</Text>
        <Text style={[reportStyles.tableCell, reportStyles.statusColumn, reportStyles.tableHeaderText]}>Status</Text>
      </View>
      {members.map((member) => (
        <View key={member.id} style={reportStyles.tableRow}>
          <Text style={[reportStyles.tableCell, reportStyles.memberColumn]}>{member.name}</Text>
          <Text style={[reportStyles.tableCell, reportStyles.amountColumn]}>
            {auction.waivedContributionMemberIds?.includes(member.id)
              ? '₹0 / ₹0'
              : `${formatCurrency(auction.contributions?.find((item) => item.memberId === member.id)?.amount ?? (auction.paidMemberIds.includes(member.id) ? contribution - auction.dividendPerMember : 0))} / ${formatCurrency(contribution - auction.dividendPerMember)}`}
            {adminFeePerMember > 0 ? `\nFee ${formatCurrency(roundPayments.find((payment) => payment.memberId === member.id && payment.type === 'admin-fee')?.amount ?? 0)} / ${formatCurrency(adminFeePerMember)}` : ''}
          </Text>
          <Text style={[reportStyles.tableCell, reportStyles.statusColumn, auction.waivedContributionMemberIds?.includes(member.id) || auction.paidMemberIds.includes(member.id) ? reportStyles.paid : reportStyles.unpaid]}>
            {auction.waivedContributionMemberIds?.includes(member.id)
              ? 'Waived'
              : auction.paidMemberIds.includes(member.id) ? 'Paid' : 'Not paid'}
            {roundPayments.find((payment) => payment.memberId === member.id && payment.type === 'collection')?.paidByName
              ? `\nby ${roundPayments.find((payment) => payment.memberId === member.id && payment.type === 'collection')?.paidByName}`
              : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PreviousWinners({ group, round }: { group: Group; round: number }) {
  const previous = getPreviousAuctionWinners(group, round);
  return (
    <View style={reportStyles.previousSection}>
      <Text style={reportStyles.sectionHeading}>Previous chit winners</Text>
      {previous.length > 0
        ? previous.map((auction) => (
          <Text key={auction.id} style={reportStyles.previousWinner}>
            Round {auction.round} · {formatReportDate(auction.date)} · {auction.outcomeType === 'final-payout' ? 'Final payout' : 'Auction'} · {auction.winnerName} · {formatCurrency(auction.payoutAmount)}
          </Text>
        ))
        : <Text style={reportStyles.info}>No earlier auctions recorded.</Text>}
    </View>
  );
}

function getTodayDate(): string {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getReportFileName(groupName: string, selection: ReportSelection): string {
  const safeGroupName = groupName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'chiti-group';
  return selection.type === 'history'
    ? `${safeGroupName}-auction-history`
    : `${safeGroupName}-round-${selection.round}-auction`;
}

function Button({ label, onPress, palette, disabled = false }: { label: string; onPress: () => void; palette: typeof lightColors; disabled?: boolean }) {
  return (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: disabled ? 0.55 : 1 }]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SettlementLine({
  label,
  value,
  palette,
  strong = false,
}: {
  label: string;
  value: number;
  palette: typeof lightColors;
  strong?: boolean;
}) {
  return (
    <View style={styles.settlementLine}>
      <Text style={[styles.settlementText, { color: palette.text, fontWeight: strong ? '800' : '500' }]}>{label}</Text>
      <Text style={[styles.settlementText, { color: palette.text, fontWeight: strong ? '800' : '700' }]}>
        ₹{value.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

function getChitTypeLabel(type: Group['chitType']): string {
  if (type === 'fixed-discount') return 'Fixed discount';
  if (type === 'lucky-draw') return 'Lucky draw';
  return 'Auction chit';
}

function pickRandomIndex(length: number): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function NavItem({ label, active = false, onPress, palette }: { label: string; active?: boolean; onPress: () => void; palette: typeof lightColors }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navText, { color: active ? palette.primary : palette.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const lightColors = {
  bg: '#f5f5f1',
  card: '#ffffff',
  header: '#f6f8f4',
  border: '#e3e7df',
  primary: '#1b7f6a',
  primarySoft: '#dff5ee',
  softBg: '#eef3f0',
  danger: '#b8413a',
  text: '#17212b',
  muted: '#54606d',
};

const darkColors = {
  bg: '#111827',
  card: '#1a2333',
  header: '#131d2a',
  border: '#2c3a4d',
  primary: '#7ae4c5',
  primarySoft: '#103a31',
  softBg: '#1d2d3f',
  danger: '#ff938b',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 18, paddingBottom: 110 },
  backLink: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontWeight: '700', fontSize: 14 },
  pageTitle: { fontSize: 28, fontWeight: '800' },
  groupTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  muted: { fontSize: 13, lineHeight: 20, marginTop: 5 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, minHeight: 48, marginBottom: 12 },
  memberPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  memberChoice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 },
  helpText: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  paymentChoice: { minHeight: 58, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  bidControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 },
  raiseButton: { minHeight: 40, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  settlementCard: { borderRadius: 14, padding: 12, marginBottom: 12 },
  settlementTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  settlementLine: { minHeight: 29, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  settlementText: { flex: 1, fontSize: 12 },
  paymentMember: { flex: 1, fontSize: 14, fontWeight: '600' },
  paymentMemberDetails: { flex: 1 },
  amountInput: { flex: 1, minWidth: 0, minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, textAlign: 'right', fontSize: 13 },
  paymentInputs: { flex: 1.4, flexDirection: 'row', gap: 6 },
  remainderChoices: { gap: 8, marginBottom: 12 },
  remainderChoice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  remainderTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  remainderDetail: { fontSize: 12, lineHeight: 17 },
  paymentStatus: { fontSize: 13, fontWeight: '800' },
  errorText: { color: '#b42318', fontSize: 13, lineHeight: 18, marginVertical: 8 },
  successText: { fontSize: 13, lineHeight: 18, fontWeight: '700', marginVertical: 8 },
  primaryButton: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  notice: { borderRadius: 14, padding: 14, marginTop: 16 },
  exportActions: { flexDirection: 'row', marginBottom: 10 },
  exportButton: { flex: 1, minHeight: 46, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exportButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  historyCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  historyTitle: { fontWeight: '800', fontSize: 14 },
  historyWinner: { marginTop: 4, fontWeight: '700', fontSize: 13 },
  paymentSummary: { marginTop: 5, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  roundExportButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  historyMembers: { marginTop: 8 },
  historyMemberRow: { minHeight: 34, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyMemberName: { flex: 1, fontSize: 12 },
  reportPreview: { marginTop: 18 },
  previewLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  captureFrame: { alignSelf: 'stretch' },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 11, fontWeight: '700' },
  exportingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  exportingText: { color: '#ffffff', fontWeight: '700' },
});

const reportStyles = StyleSheet.create({
  page: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 22, backgroundColor: '#ffffff' },
  brand: { color: '#1b7f6a', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  groupName: { color: '#17212b', fontSize: 23, fontWeight: '800', marginTop: 8 },
  meta: { color: '#54606d', fontSize: 11, lineHeight: 17, marginTop: 5 },
  rule: { height: 2, backgroundColor: '#dff5ee', marginVertical: 14 },
  auctionBlock: { marginBottom: 18 },
  sectionHeading: { color: '#17212b', fontSize: 15, fontWeight: '800', marginBottom: 7 },
  info: { color: '#344454', fontSize: 11, lineHeight: 17 },
  unpaid: { color: '#b42318', fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  paid: { color: '#1b7f6a', fontWeight: '800' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#eef3f0', paddingVertical: 7, paddingHorizontal: 6, marginTop: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dfe5e1', paddingVertical: 6, paddingHorizontal: 6 },
  tableCell: { color: '#344454', fontSize: 10, lineHeight: 14 },
  tableHeaderText: { color: '#17212b', fontWeight: '800' },
  memberColumn: { flex: 1.3 },
  amountColumn: { flex: 0.8, textAlign: 'right' },
  statusColumn: { flex: 0.8, textAlign: 'right', fontWeight: '700' },
  previousSection: { borderTopWidth: 1, borderTopColor: '#dfe5e1', paddingTop: 12, marginTop: 2 },
  previousWinner: { color: '#344454', fontSize: 11, lineHeight: 18 },
  footer: { color: '#71808d', fontSize: 9, textAlign: 'center', borderTopWidth: 1, borderTopColor: '#dfe5e1', paddingTop: 10, marginTop: 14 },
});
