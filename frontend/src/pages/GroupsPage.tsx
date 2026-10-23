import { Check, ChevronDown, ChevronUp, LogOut, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  createGroup,
  cancelGroupInvitation,
  getFriends,
  getGroupInvitations,
  getGroupMembers,
  getGroups,
  getReceivedGroupInvitations,
  inviteFriendToGroup,
  leaveGroup,
  removeGroupMember,
  respondToGroupInvitation,
  updateGroup,
  updateGroupMemberRole,
} from '../lib/api';
import { getCurrentUser } from '../lib/api';
import type { Group, GroupInvitationRecord, GroupMember, GroupSentInvitationRecord, PublicProfile } from '../types';

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitationRecord[]>([]);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sentInvitations, setSentInvitations] = useState<GroupSentInvitationRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupList, received, friendList] = await Promise.all([
        getGroups(),
        getReceivedGroupInvitations(),
        getFriends(),
      ]);
      setGroups(groupList);
      setInvitations(received);
      setFriends(friendList);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los grupos.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openGroup(group: Group) {
    setSelectedGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description ?? '');
    setSelectedFriend('');
    setMembers([]);
    setSentInvitations([]);
    setError('');
    setMembersLoading(true);
    try {
      const groupMembers = await getGroupMembers(group.id);
      setMembers(groupMembers);
      const user = getCurrentUser();
      const mayInvite = group.owner_public_id === user?.public_id || groupMembers.some(
        member => member.public_id === user?.public_id && member.role === 'Admin',
      );
      if (mayInvite) setSentInvitations(await getGroupInvitations(group.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los miembros.');
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleUpdateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup) return;

    setBusy('update-group');
    setError('');
    setNotice('');
    try {
      const updated = await updateGroup(selectedGroup.id, {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
      });
      setGroups(current => current.map(group => group.id === updated.id
        ? { ...group, ...updated, members_count: group.members_count }
        : group));
      setSelectedGroup(current => current?.id === updated.id
        ? { ...current, ...updated, members_count: current.members_count }
        : current);
      setNotice('Grupo actualizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el grupo.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('create');
    setError('');
    setNotice('');
    try {
      await createGroup({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      if (await refresh()) setNotice('Grupo creado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.');
    } finally {
      setBusy(null);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || !selectedFriend) return;

    setBusy('invite');
    setError('');
    setNotice('');
    try {
      await inviteFriendToGroup(selectedGroup.id, selectedFriend);
      setSelectedFriend('');
      setNotice('Invitación enviada.');
      try {
        setSentInvitations(await getGroupInvitations(selectedGroup.id));
      } catch (err) {
        setError(err instanceof Error
          ? `La invitación se envió, pero no se pudo actualizar la lista: ${err.message}`
          : 'La invitación se envió, pero no se pudo actualizar la lista.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.');
    } finally {
      setBusy(null);
    }
  }

  async function handleInvitation(invitation: GroupInvitationRecord, response: 'accept' | 'reject') {
    setBusy(`invitation-${invitation.id}`);
    setError('');
    setNotice('');
    try {
      await respondToGroupInvitation(invitation.id, response);
      const loaded = await refresh();
      if (loaded) setNotice(response === 'accept' ? 'Te uniste al grupo.' : 'Invitación rechazada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo responder a la invitación.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelInvitation(invitation: GroupSentInvitationRecord) {
    if (!window.confirm(`¿Cancelar la invitación enviada a ${invitation.invitee.name}?`)) return;
    setBusy(`cancel-invitation-${invitation.id}`);
    setError('');
    setNotice('');
    try {
      await cancelGroupInvitation(invitation.id);
      setSentInvitations(current => current.filter(item => item.id !== invitation.id));
      setNotice(`Se canceló la invitación de ${invitation.invitee.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la invitación.');
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(member: GroupMember, role: 'Admin' | 'Member') {
    if (!selectedGroup) return;
    setBusy(`role-${member.public_id}`);
    setError('');
    setNotice('');
    try {
      await updateGroupMemberRole(selectedGroup.id, member.public_id, role);
      setMembers(current => current.map(item => item.public_id === member.public_id ? { ...item, role } : item));
      setNotice(`Permiso actualizado para ${member.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el permiso.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    if (!selectedGroup || !window.confirm(`¿Eliminar a ${member.name} del grupo?`)) return;
    setBusy(`remove-${member.public_id}`);
    setError('');
    setNotice('');
    try {
      await removeGroupMember(selectedGroup.id, member.public_id);
      setMembers(current => current.filter(item => item.public_id !== member.public_id));
      setNotice(`${member.name} fue eliminado del grupo.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar al miembro.');
    } finally {
      setBusy(null);
    }
  }

  async function handleLeave() {
    if (!selectedGroup || !window.confirm(`¿Salir de ${selectedGroup.name}?`)) return;
    setBusy('leave');
    setError('');
    setNotice('');
    try {
      await leaveGroup(selectedGroup.id);
      setSelectedGroup(null);
      setMembers([]);
      if (await refresh()) setNotice('Has salido del grupo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo salir del grupo.');
    } finally {
      setBusy(null);
    }
  }

  const currentUser = getCurrentUser();
  const isOwner = Boolean(selectedGroup && selectedGroup.owner_public_id === currentUser?.public_id);
  const canUpdateGroup = isOwner || members.some(
    member => member.public_id === currentUser?.public_id && member.role === 'Admin',
  );
  const canInvite = isOwner || members.some(
    member => member.public_id === currentUser?.public_id && member.role === 'Admin',
  );

  return (
    <section className="view groups-view" aria-labelledby="groups-title">
      <header className="welcome">
        <div>
          <span className="date-label">NEXORA / GRUPOS</span>
          <h1 id="groups-title">Grupos</h1>
          <p>Organiza espacios compartidos, invita a tus amistades y reparte responsabilidades.</p>
        </div>
        <div className="social-header-stats" aria-label="Resumen de grupos">
          <span className="social-stat"><b>{groups.length}</b> grupos</span>
          <span className="social-stat"><b>{invitations.length}</b> invitaciones</span>
        </div>
      </header>

      {error && (
        <div className="alert" role="alert">
          {error}
          <button
            className="button secondary notification-action"
            type="button"
            onClick={() => selectedGroup ? void openGroup(selectedGroup) : void refresh()}
          >
            Reintentar
          </button>
        </div>
      )}
      {notice && <p className="notification-notice" role="status">{notice}</p>}

      <section className="panel group-create">
        <div className="section-title">
          <div>
            <span>NUEVO ESPACIO</span>
            <h2>Crear un grupo</h2>
          </div>
        </div>
        <form onSubmit={handleCreate}>
          <div className="form-field">
            <label htmlFor="group-name">Nombre</label>
            <input id="group-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
          </div>
          <div className="form-field">
            <label htmlFor="group-description">Descripción</label>
            <textarea
              id="group-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <button type="submit" className="button primary" disabled={busy !== null || !name.trim()}>
            {busy === 'create' ? 'Creando…' : 'Crear grupo'}
          </button>
        </form>
      </section>

      {invitations.length > 0 && (
        <section className="panel social-section" aria-labelledby="group-invitations-title">
          <div className="section-title">
            <div>
              <span>INVITACIONES</span>
              <h2 id="group-invitations-title">Recibidas <span className="count-pill">{invitations.length}</span></h2>
            </div>
          </div>
          <div className="social-section-body">
            <ul className="social-list">
              {invitations.map(invitation => (
                <li className="card social-card" key={invitation.id}>
                  <div className="social-profile-copy">
                    <b>{invitation.group.name}</b>
                    <small>Invitación de {invitation.inviter.name}</small>
                  </div>
                  <div className="social-actions">
                    <button className="button primary" type="button" disabled={busy !== null} onClick={() => void handleInvitation(invitation, 'accept')}>
                      <Check size={14} aria-hidden="true" /> Aceptar
                    </button>
                    <button className="button secondary" type="button" disabled={busy !== null} onClick={() => void handleInvitation(invitation, 'reject')}>
                      <X size={14} aria-hidden="true" /> Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {loading ? (
        <div className="card loading-state" role="status">Cargando grupos…</div>
      ) : !error && (
        <section className="panel social-section" aria-labelledby="my-groups-title">
          <div className="section-title">
            <div>
              <span>TU ESPACIO</span>
              <h2 id="my-groups-title">Mis grupos <span className="count-pill">{groups.length}</span></h2>
            </div>
          </div>
          {groups.length ? (
            <div className="social-section-body">
              <ul className="group-list">
              {groups.map(group => (
                <li className="card group-card" key={group.id}>
                  <div className="group-card-heading">
                    <div>
                      <h3>{group.name}</h3>
                      <p>{group.description || 'Sin descripción'}</p>
                      <small>{group.members_count ?? 0} miembros</small>
                    </div>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy !== null || membersLoading}
                      aria-expanded={selectedGroup?.id === group.id}
                      onClick={() => selectedGroup?.id === group.id ? setSelectedGroup(null) : void openGroup(group)}
                    >
                    {selectedGroup?.id === group.id ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                      {selectedGroup?.id === group.id ? 'Cerrar' : 'Administrar'}
                    </button>
                  </div>

                  {selectedGroup?.id === group.id && (
                    <div className="group-management">
                      {canUpdateGroup && (
                        <form className="group-edit-form" onSubmit={handleUpdateGroup}>
                          <h4>Detalles del grupo</h4>
                          <div className="form-field">
                            <label htmlFor={`group-name-${group.id}`}>Nombre</label>
                            <input
                              id={`group-name-${group.id}`}
                              value={groupName}
                              onChange={event => setGroupName(event.target.value)}
                              maxLength={80}
                              required
                              disabled={busy !== null}
                            />
                          </div>
                          <div className="form-field">
                            <label htmlFor={`group-description-${group.id}`}>Descripción</label>
                            <textarea
                              id={`group-description-${group.id}`}
                              value={groupDescription}
                              onChange={event => setGroupDescription(event.target.value)}
                              maxLength={500}
                              rows={3}
                              disabled={busy !== null}
                            />
                          </div>
                          <button
                            className="button secondary"
                            type="submit"
                            disabled={busy !== null || !groupName.trim()}
                          >
                            {busy === 'update-group' ? 'Guardando…' : 'Guardar detalles'}
                          </button>
                        </form>
                      )}

                      {canInvite && (
                        <form className="group-invite-form" onSubmit={handleInvite}>
                          <label htmlFor="group-invite-friend">Invitar una amistad</label>
                          <div>
                            <select id="group-invite-friend" value={selectedFriend} onChange={event => setSelectedFriend(event.target.value)} required>
                              <option value="">Selecciona a una persona</option>
                              {friends.map(friend => (
                                <option key={friend.public_id} value={friend.public_id}>{friend.name}</option>
                              ))}
                            </select>
                            <button className="button primary" type="submit" disabled={busy !== null || !selectedFriend}>
                              <UserPlus size={14} aria-hidden="true" /> Invitar
                            </button>
                          </div>
                          {friends.length === 0 && <small>Primero agrega amistades desde Social.</small>}
                        </form>
                      )}

                      {canInvite && (
                        <div className="group-pending-invitations">
                          <h4>Invitaciones pendientes</h4>
                          {membersLoading ? (
                            <p className="social-empty" role="status">Cargando invitaciones…</p>
                          ) : sentInvitations.length ? (
                            <ul className="group-members">
                              {sentInvitations.map(invitation => (
                                <li key={invitation.id}>
                                  <span>
                                    {invitation.invitee.name}
                                    <small>{invitation.expires_at ? `Vence ${new Date(invitation.expires_at).toLocaleDateString('es')}` : 'Sin fecha de vencimiento'}</small>
                                  </span>
                                  <button
                                    className="button secondary"
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() => void handleCancelInvitation(invitation)}
                                  >
                                    {busy === `cancel-invitation-${invitation.id}` ? 'Cancelando…' : 'Cancelar'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="social-empty">No hay invitaciones pendientes.</p>}
                        </div>
                      )}

                      <h4>Miembros</h4>
                      {membersLoading ? (
                        <p className="social-empty" role="status">Cargando miembros…</p>
                      ) : (
                        <ul className="group-members">
                          {members.map(member => (
                            <li key={member.public_id}>
                              <span>{member.name}<small>{member.role}</small></span>
                              {isOwner && member.role !== 'Owner' && (
                                <div className="group-member-actions">
                                  <select
                                    aria-label={`Permiso de ${member.name}`}
                                    value={member.role}
                                    disabled={busy !== null}
                                    onChange={event => {
                                      const role = event.target.value;
                                      if (role === 'Admin' || role === 'Member') void changeRole(member, role);
                                    }}
                                  >
                                    <option value="Member">Miembro</option>
                                    <option value="Admin">Administrador</option>
                                  </select>
                                  <button className="icon-button danger" type="button" aria-label={`Eliminar a ${member.name}`} disabled={busy !== null} onClick={() => void handleRemoveMember(member)}>
                                    <X size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button className="button secondary group-leave" type="button" disabled={busy !== null} onClick={() => void handleLeave()}>
                        <LogOut size={14} aria-hidden="true" /> Salir del grupo
                      </button>
                    </div>
                  )}
                </li>
              ))}
              </ul>
            </div>
          ) : <p className="social-empty social-section-body">Todavía no perteneces a ningún grupo.</p>}
        </section>
      )}
    </section>
  );
}
