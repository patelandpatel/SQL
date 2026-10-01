-- New database only. Deliberately fails if the schema exists; does not drop data.
BEGIN;
CREATE SCHEMA dannys_diner;
CREATE TABLE dannys_diner.sales (customer_id varchar(1), order_date date, product_id integer);
CREATE TABLE dannys_diner.menu (product_id integer, product_name varchar(5), price integer);
CREATE TABLE dannys_diner.members (customer_id varchar(1), join_date date);
INSERT INTO dannys_diner.sales VALUES
('A', '2021-01-06', 1),
('A', '2021-01-06', 2),
('A', '2021-01-07', 1),
('A', '2021-01-07', 2),
('A', '2021-01-13', 3),
('A', '2021-01-14', 3),
('A', '2021-01-31', 3),
('A', '2021-02-01', 2),
('B', '2021-01-08', 1),
('B', '2021-01-08', 3),
('B', '2021-01-09', 2),
('B', '2021-01-09', 2),
('B', '2021-01-15', 1),
('B', '2021-01-16', 3),
('B', '2021-01-31', 1),
('B', '2021-02-01', 3),
('C', '2021-01-01', 1),
('C', '2021-01-01', 2),
('C', '2021-01-02', 1),
('C', '2021-01-02', 2);
INSERT INTO dannys_diner.menu VALUES
(1, 'sushi', 10),
(2, 'curry', 15),
(3, 'ramen', 12);
INSERT INTO dannys_diner.members VALUES
('A', '2021-01-07'),
('B', '2021-01-09');
COMMIT;
