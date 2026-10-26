import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type TeamRecord = {
  _id?: string;
  name: string;
  members: string[];
};

export default function Teams() {
  const [teams, setTeams] = useState<TeamRecord[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    getJson<{ teams: TeamRecord[] }>('/api/teams')
      .then(({ teams: result }) => {
        if (active) setTeams(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Teams</h2>
        <p>Manage teams and members.</p>
        {hasError ? (
          <p role="alert">Unable to load teams.</p>
        ) : teams === null ? (
          <p role="status">Loading teams...</p>
        ) : teams.length === 0 ? (
          <p>No teams yet.</p>
        ) : (
          <ul className="list-group list-group-flush">
            {teams.map((team) => (
              <li className="list-group-item" key={team._id ?? team.name}>
                <h3 className="h5">{team.name}</h3>
                <p className="mb-0">
                  Members: {team.members.length > 0 ? team.members.join(', ') : 'No members yet.'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
