// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

contract Splitwise {
    mapping(address => mapping(address => uint32)) public debts;
    mapping(address => bool) public users;
    address[] public userList;
    
    function lookup(address debtor, address creditor) public view returns (uint32) {
        return debts[debtor][creditor];
    }

    function add_IOU(address creditor, uint32 amount, address[] calldata cycle_path) public {
        address debtor = msg.sender;
        require(debtor != creditor, "Sender cannot be the same as creditor.");
        require(creditor != address(0), "Creditor cannot be the zero address.");

        _addUser(debtor);
        _addUser(creditor);

        uint len = cycle_path.length;
        if (len == 0) {
            debts[debtor][creditor] += amount;
            return;
        }

        require(cycle_path[0] == creditor, "Cycle must start with creditor.");
        require(cycle_path[len - 1] == debtor, "Cycle must end with debtor.");

        // Validate full cycle exists and find minimum amount
        uint32 min_amount = amount;
        for (uint i = 0; i < len - 1; i++) {
            uint32 val = debts[cycle_path[i]][cycle_path[i + 1]];
            if (val == 0) {
                // Abort cycle resolution if any part doesn't exist
                debts[debtor][creditor] += amount;
                return;
            }
            if (val < min_amount) {
                min_amount = val;
            }
        }

        // Subtract from cycle
        for (uint i = 0; i < len - 1; i++) {
            address from = cycle_path[i];
            address to = cycle_path[i + 1];
            debts[from][to] -= min_amount;
            if (debts[from][to] == 0) {
                delete debts[from][to];
            }
        }

        // Add remaining to the new IOU
        uint32 remaining = amount - min_amount;
        if (remaining > 0) {
            debts[debtor][creditor] += remaining;
        }

        // Clean up
        for (uint i = 0; i < len; i++) {
            _cleanupUser(cycle_path[i]);
        }
        _cleanupUser(debtor);
        _cleanupUser(creditor);
    }


    function getAllUsers() public view returns (address[] memory) {
        return userList;
    }

    // --- Internal utility functions ---

    function _addUser(address user) internal {
        if (!users[user]) {
            users[user] = true;
            userList.push(user);
        }
    }

    function _cleanupUser(address user) internal {
        if (!_hasAnyDebts(user)) {
            users[user] = false;
            for (uint i = 0; i < userList.length; i++) {
                if (userList[i] == user) {
                    userList[i] = userList[userList.length - 1];
                    userList.pop();
                    break;
                }
            }
        }
    }

    function _hasAnyDebts(address user) internal view returns (bool) {
        // Instead of only checking `userList`, scan full map to ensure accuracy
        for (uint i = 0; i < userList.length; i++) {
            address other = userList[i];
            if (debts[user][other] > 0 || debts[other][user] > 0) {
                return true;
            }
        }
        return false;
    }
}
