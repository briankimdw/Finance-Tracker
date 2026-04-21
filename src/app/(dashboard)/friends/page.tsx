"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  UserPlus, Check, X, Clock, Users, AlertCircle, CheckCircle,
  AtSign, Search, Trash2, User as UserIcon, Sparkles, Plane, Target, MapPin,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import { getTripIcon } from "@/lib/tripIcons";
import { getGoalIcon } from "@/lib/goalIcons";

function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const palette = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];
  const color = palette[(initial.charCodeAt(0) || 0) % palette.length];
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

export default function FriendsPage() {
  const { user } = useAuth();
  const { profile, setUsername, updateDisplayName } = useProfile();
  const { friends, incoming, outgoing, loading, sendRequest, acceptRequest, rejectRequest, cancelRequest, removeFriend } = useFriends();
  const { trips: tripInvites, goals: goalInvites, acceptTripInvite, declineTripInvite, acceptGoalInvite, declineGoalInvite } = usePendingInvites();

  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const handleSaveUsername = async () => {
    setUsernameError(null);
    setUsernameSaving(true);
    setUsernameSuccess(false);
    const res = await setUsername(usernameInput);
    setUsernameSaving(false);
    if (res.ok) {
      setUsernameSuccess(true);
      setUsernameInput("");
      setTimeout(() => setUsernameSuccess(false), 2500);
    } else {
      setUsernameError(res.error || "Couldn't save username");
    }
  };

  const handleSaveDisplayName = async () => {
    if (!displayNameInput.trim()) return;
    setDisplayNameSaving(true);
    await updateDisplayName(displayNameInput.trim());
    setDisplayNameSaving(false);
    setDisplayNameInput("");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setNotice(null);
    setSearching(true);
    const res = await sendRequest(identifier);
    setSearching(false);
    if (res.ok) {
      setNotice({ kind: "success", text: res.info || `Request sent to ${identifier.trim()}` });
      setIdentifier("");
    } else if (res.info) {
      setNotice({ kind: "info", text: res.info });
    } else {
      setNotice({ kind: "error", text: res.error || "Couldn't send request" });
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20">
        <Users size={32} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-700">Sign in to manage friends</p>
        <p className="text-xs text-gray-400 mt-1">Create an account or sign in to add friends and co-plan trips.</p>
      </div>
    );
  }

  const needsUsername = !profile?.username;
  const input = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
        <p className="text-gray-400 text-sm mt-0.5">Add friends to invite them to shared trips & goals without sharing email addresses.</p>
      </div>

      {/* Profile setup */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={profile?.display_name || profile?.username || user.email} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{profile?.display_name || user.email?.split("@")[0]}</p>
            <p className="text-xs text-gray-400 truncate">
              {profile?.username ? <>@{profile.username}</> : <span className="text-amber-600">Set a username so friends can find you</span>}
              {" · "}{user.email}
            </p>
          </div>
        </div>

        {needsUsername && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <Sparkles size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Pick a username</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Letters, numbers, underscores · 3–20 chars. This is how friends will find and invite you.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><AtSign size={11} /> Username</label>
            <div className="flex gap-2">
              <input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder={profile?.username || "yourname"} className={input} />
              <button onClick={handleSaveUsername} disabled={usernameSaving || !usernameInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs px-3 rounded-lg shrink-0">
                {usernameSaving ? "..." : "Save"}
              </button>
            </div>
            {usernameError && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={10} />{usernameError}</p>}
            {usernameSuccess && <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle size={10} /> Username saved.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><UserIcon size={11} /> Display name</label>
            <div className="flex gap-2">
              <input type="text" value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} placeholder={profile?.display_name || "Your name"} className={input} />
              <button onClick={handleSaveDisplayName} disabled={displayNameSaving || !displayNameInput.trim()}
                className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium text-xs px-3 rounded-lg shrink-0">
                {displayNameSaving ? "..." : "Save"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Shown in trips and on invites.</p>
          </div>
        </div>
      </div>

      {/* Add a friend */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Search size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Add a friend</h2>
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Username or email (e.g. janedoe or jane@example.com)" className={input} />
          <button type="submit" disabled={searching || !identifier.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center gap-1.5 shrink-0 transition-all hover:shadow-lg hover:shadow-blue-600/20">
            <UserPlus size={14} /> {searching ? "Sending..." : "Send request"}
          </button>
        </form>
        {notice && (
          <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
            notice.kind === "success" ? "bg-green-50 text-green-700 border border-green-100" :
            notice.kind === "info" ? "bg-blue-50 text-blue-700 border border-blue-100" :
            "bg-red-50 text-red-700 border border-red-100"
          }`}>
            {notice.kind === "error" ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle size={13} className="mt-0.5 shrink-0" />}
            <span>{notice.text}</span>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2">
          They&apos;ll see your request in their Friends tab and can accept or reject it.
          Only verified friends can be added to your trips without email invites.
        </p>
      </div>

      {/* Pending trip/goal invites */}
      {(tripInvites.length > 0 || goalInvites.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plane size={14} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">You&apos;re invited</h2>
            </div>
            <span className="text-xs font-medium bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{tripInvites.length + goalInvites.length}</span>
          </div>
          <div className="space-y-2">
            {tripInvites.map(({ invite, trip, inviter }) => {
              if (!trip) return null;
              const Icon = getTripIcon(trip.icon);
              return (
                <motion.div key={invite.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-sky-50/50 border border-sky-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: trip.color, color: "white" }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">
                        <Plane size={10} /> TRIP
                      </span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{trip.name}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {inviter ? (inviter.display_name || inviter.username || "Someone") : "Someone"} invited you
                      {trip.destination && <> · <MapPin size={9} className="inline -mt-0.5" /> {trip.destination}</>}
                    </p>
                  </div>
                  <button onClick={() => acceptTripInvite(invite)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <Check size={12} /> Accept
                  </button>
                  <button onClick={() => declineTripInvite(invite)} className="border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <X size={12} /> Decline
                  </button>
                </motion.div>
              );
            })}
            {goalInvites.map(({ invite, goal, inviter }) => {
              if (!goal) return null;
              const Icon = getGoalIcon(goal.icon);
              return (
                <motion.div key={invite.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${goal.color}`, color: "white" }}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                        <Target size={10} /> GOAL
                      </span>
                      <p className="text-sm font-semibold text-gray-900 truncate">{goal.name}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {inviter ? (inviter.display_name || inviter.username || "Someone") : "Someone"} invited you to save together · ${Number(goal.target_amount).toFixed(0)} target
                    </p>
                  </div>
                  <button onClick={() => acceptGoalInvite(invite)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <Check size={12} /> Accept
                  </button>
                  <button onClick={() => declineGoalInvite(invite)} className="border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <X size={12} /> Decline
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserPlus size={14} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Friend requests</h2>
            </div>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{incoming.length}</span>
          </div>
          <div className="space-y-2">
            {incoming.map((r) => {
              const p = r.from_profile;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <Avatar name={p?.display_name || p?.username || p?.email} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p?.display_name || p?.username || "Someone"}</p>
                    <p className="text-[11px] text-gray-500 truncate">{p?.username ? <>@{p.username}</> : p?.email}</p>
                  </div>
                  <button onClick={() => acceptRequest(r.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <Check size={12} /> Accept
                  </button>
                  <button onClick={() => rejectRequest(r.id)} className="border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1">
                    <X size={12} /> Reject
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Pending (sent)</h2>
          </div>
          <div className="space-y-2">
            {outgoing.map((r) => {
              const p = r.to_profile;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Avatar name={p?.display_name || p?.username || p?.email} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{p?.display_name || p?.username || "Someone"}</p>
                    <p className="text-[11px] text-gray-400 truncate">{p?.username ? <>@{p.username}</> : p?.email} · waiting for them to accept</p>
                  </div>
                  <button onClick={() => cancelRequest(r.id)} className="text-gray-400 hover:text-red-600 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-red-50">
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Your friends</h2>
          </div>
          <span className="text-xs text-gray-400">{friends.length}</span>
        </div>

        {loading ? (
          <p className="text-center text-xs text-gray-400 py-6">Loading...</p>
        ) : friends.length === 0 ? (
          <div className="text-center py-8">
            <Users size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">No friends yet</p>
            <p className="text-xs text-gray-400 mt-1">Send a request above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {friends.map((f) => (
              <motion.div key={f.requestId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="group flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200">
                <Avatar name={f.profile?.display_name || f.profile?.username || f.profile?.email} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{f.profile?.display_name || f.profile?.username || "Friend"}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {f.profile?.username ? <>@{f.profile.username}</> : f.profile?.email}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm(`Remove ${f.profile?.display_name || f.profile?.username || "this friend"}?`)) removeFriend(f.userId); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-opacity"
                  title="Remove friend">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
