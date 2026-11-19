-- Anonymous repair delay reports. One row per shared repair.
-- Privacy: no names, notes, IP addresses or exact dates. The finest date kept is the month the
-- chair broke; created/updated are stored as dates only.
CREATE TABLE reports (
    id uuid PRIMARY KEY,
    token_hash bytea NOT NULL,
    schema_version smallint NOT NULL,
    state char(2) NOT NULL,
    payer text NOT NULL,
    supplier text NOT NULL,
    problem text NOT NULL,
    severity text NOT NULL,
    broke_month date NOT NULL CHECK (extract(day FROM broke_month) = 1),
    resolved boolean NOT NULL,
    days_without_chair integer NOT NULL CHECK (days_without_chair BETWEEN 0 AND 3650),
    days_to_first_visit integer CHECK (days_to_first_visit BETWEEN 0 AND 3650),
    days_waiting_approval integer CHECK (days_waiting_approval BETWEEN 0 AND 3650),
    days_waiting_parts integer CHECK (days_waiting_parts BETWEEN 0 AND 3650),
    promises_made integer NOT NULL CHECK (promises_made BETWEEN 0 AND 1000),
    promises_broken integer NOT NULL CHECK (promises_broken BETWEEN 0 AND promises_made),
    had_loaner boolean NOT NULL,
    state_deadline_missed boolean,
    created_on date NOT NULL DEFAULT current_date,
    updated_on date NOT NULL DEFAULT current_date
);

CREATE INDEX reports_state_idx ON reports (state);
CREATE INDEX reports_broke_month_idx ON reports (broke_month);
