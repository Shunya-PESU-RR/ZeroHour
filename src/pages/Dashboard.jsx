
import { useState } from 'react';
import {
  useData,
  selectRequests,
  selectTeams,
  selectMentors,
  updateRequest,
} from '../lib/api';
import { REQUEST_STATUS as S } from '../types';

function RequestsTab() {
  const requests = useData(selectRequests);
  const mentors = useData(selectMentors);
  const teams = useData(selectTeams);
  const [claimer, setClaimer] = useState({});

  const mentorName = (id) =>
    mentors.find((mentor) => mentor.id === id)?.name ?? 'Unassigned';

  const columns = [
    { key: S.OPEN, title: 'Open' },
    { key: S.CLAIMED, title: 'Claimed' },
    { key: S.RESOLVED, title: 'Resolved' },
  ];

  const teamForTable = (table) =>
    teams.find((team) => team.table === table);

  return (
    <section>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>Mentor requests</h3>
          <p>Track and manage requests submitted by teams.</p>
        </div>

        <span>
          {requests.length} total request{requests.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="board">
        {columns.map((column) => {
          const items = requests.filter(
            (request) => request.status === column.key
          );

          return (
            <div className="column" key={column.key}>
              <h3>
                {column.title} <small>{items.length}</small>
              </h3>

              {items.length === 0 && (
                <p className="empty">
                  No {column.title.toLowerCase()} requests.
                </p>
              )}

              {items.map((request) => {
                const team = teamForTable(request.table);

                return (
                  <article
                    className={`card ${request.status}`}
                    key={request.id}
                  >
                    <strong>
                      Table {request.table}
                      {team?.name ? ` · ${team.name}` : ''}
                    </strong>

                    <p>{request.issue}</p>

                    {request.claimedBy && (
                      <small>
                        Mentor: {mentorName(request.claimedBy)}
                      </small>
                    )}

                    <div className="row">
                      {request.status === S.OPEN && (
                        <>
                          <select
                            aria-label={`Assign mentor for table ${request.table}`}
                            value={claimer[request.id] || ''}
                            onChange={(event) =>
                              setClaimer((previous) => ({
                                ...previous,
                                [request.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Assign mentor</option>

                            {mentors.map((mentor) => (
                              <option key={mentor.id} value={mentor.id}>
                                {mentor.name}
                              </option>
                            ))}
                          </select>

                          <button
                            disabled={!claimer[request.id]}
                            onClick={() =>
                              updateRequest(request.id, {
                                status: S.CLAIMED,
                                claimedBy: claimer[request.id],
                              })
                            }
                          >
                            Assign
                          </button>
                        </>
                      )}

                      {request.status === S.CLAIMED && (
                        <>
                          <button
                            onClick={() =>
                              updateRequest(request.id, {
                                status: S.OPEN,
                                claimedBy: null,
                              })
                            }
                          >
                            Release
                          </button>

                          <button
                            className="primary"
                            onClick={() =>
                              updateRequest(request.id, {
                                status: S.RESOLVED,
                              })
                            }
                          >
                            Resolve
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard() {
  return (
    <section className="panel wide">
      <h2>Organizer dashboard</h2>
      <RequestsTab />
    </section>
  );
}
